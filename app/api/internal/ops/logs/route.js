/**
 * GET /api/internal/ops/logs
 * 
 * Retrieve ops event logs with filtering and pagination.
 * 
 * Query Parameters:
 * - requestId (optional): Filter by specific request ID
 * - businessId (optional): Filter by business/tenant ID
 * - tool (optional): Filter by tool name
 * - actor (optional): Filter by actor type (n8n, human, system, api)
 * - status (optional): Filter by status (success, failed, partial)
 * - limit (optional, default 50, max 100): Number of records to return
 * - skip (optional, default 0): Number of records to skip for pagination
 * - since (optional): ISO date string, filter events after this date
 * - until (optional): ISO date string, filter events before this date
 * 
 * Response:
 * {
 *   ok: true,
 *   logs: [...],
 *   pagination: { total, limit, skip, hasMore }
 * }
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 * Required scope: ops.logs.read or ops.* or *
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  COLLECTION_NAME,
  STATUS_VALUES,
  ACTOR_VALUES
} from '@/lib/schemas/opsEventLog'
import { checkRateLimitWithRequest } from '@/api/internal/ops/_lib/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/logs]'
const VERSION = 'v1.0.0'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

/**
 * Get API key scopes from environment
 */
function getApiKeyScopes() {
  const keys = {}
  
  // n8n automation key - includes logs read access
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'ops.logs.read', 'tenant.*', 'voice.*', 'billing.read']
  }
  
  // Admin key - full access
  if (env.OPS_KEY_ADMIN) {
    keys[env.OPS_KEY_ADMIN] = ['*']
  }
  
  // Legacy single key - full access for backwards compatibility
  if (env.OPS_INTERNAL_SECRET) {
    keys[env.OPS_INTERNAL_SECRET] = ['*']
  }
  
  // Fallback to ADMIN_TOKEN if nothing else configured
  if (env.ADMIN_TOKEN && Object.keys(keys).length === 0) {
    keys[env.ADMIN_TOKEN] = ['*']
  }
  
  return keys
}

/**
 * Check if a scope matches the required scope
 */
function scopeMatches(allowedScope, requiredScope) {
  if (allowedScope === '*') return true
  if (allowedScope === requiredScope) return true
  
  if (allowedScope.endsWith('.*')) {
    const prefix = allowedScope.slice(0, -2)
    return requiredScope.startsWith(prefix + '.')
  }
  
  return false
}

/**
 * Check if any of the allowed scopes permit the required scope
 */
function hasScope(allowedScopes, requiredScope) {
  return allowedScopes.some(scope => scopeMatches(scope, requiredScope))
}

// ============================================================================
// Security: Constant-Time Secret Comparison
// ============================================================================

function verifySecret(provided, expected) {
  if (!provided || !expected) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  const providedBuffer = Buffer.from(provided, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  
  if (providedBuffer.length !== expectedBuffer.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

/**
 * Get rate limit identifier from API key
 */
function getRateLimitIdentifier(apiKey) {
  if (!apiKey) return 'unknown'
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  return `key_${hash.substring(0, 8)}`
}

// ============================================================================
// Database Connection
// ============================================================================

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

// ============================================================================
// Logging
// ============================================================================

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  const logFn = level === 'error' ? console.error : console.log
  logFn(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}${dataStr}`)
}

// ============================================================================
// Authentication
// ============================================================================

function verifyAuth(request) {
  const apiKeys = getApiKeyScopes()
  
  if (Object.keys(apiKeys).length === 0) {
    return { 
      valid: false, 
      error: 'No API keys configured',
      help: 'Set OPS_KEY_N8N, OPS_KEY_ADMIN, or OPS_INTERNAL_SECRET in environment'
    }
  }
  
  const providedKey = request.headers.get('x-book8-internal-secret')
  
  if (!providedKey) {
    return { 
      valid: false, 
      error: 'Missing x-book8-internal-secret header',
      help: 'Add header: x-book8-internal-secret: <your-api-key>'
    }
  }
  
  let matchedScopes = null
  let keyId = null
  
  for (const [key, scopes] of Object.entries(apiKeys)) {
    if (verifySecret(providedKey, key)) {
      matchedScopes = scopes
      keyId = getRateLimitIdentifier(key)
      break
    }
  }
  
  if (!matchedScopes) {
    return { 
      valid: false, 
      error: 'Invalid API key',
      help: 'Verify your API key is correct'
    }
  }
  
  // Check for logs read permission
  const requiredScope = 'ops.logs.read'
  if (!hasScope(matchedScopes, requiredScope)) {
    return {
      valid: false,
      error: `API key does not have permission to read logs`,
      help: `Required scope: ${requiredScope}`
    }
  }
  
  return { 
    valid: true, 
    scopes: matchedScopes,
    keyId 
  }
}

// ============================================================================
// Query Parameter Parsing
// ============================================================================

/**
 * Parse and validate query parameters
 */
function parseQueryParams(searchParams) {
  const params = {}
  const errors = []
  
  // requestId - exact match
  const requestId = searchParams.get('requestId')
  if (requestId) {
    params.requestId = requestId
  }
  
  // businessId - exact match
  const businessId = searchParams.get('businessId')
  if (businessId) {
    params.businessId = businessId
  }
  
  // tool - exact match or prefix match with wildcard
  const tool = searchParams.get('tool')
  if (tool) {
    if (tool.endsWith('*')) {
      // Prefix match: "tenant.*" matches "tenant.ensure", "tenant.bootstrap"
      params.tool = { $regex: `^${tool.slice(0, -1)}` }
    } else {
      params.tool = tool
    }
  }
  
  // actor - must be valid enum value
  const actor = searchParams.get('actor')
  if (actor) {
    if (!ACTOR_VALUES.includes(actor)) {
      errors.push(`Invalid actor '${actor}'. Must be one of: ${ACTOR_VALUES.join(', ')}`)
    } else {
      params.actor = actor
    }
  }
  
  // status - must be valid enum value
  const status = searchParams.get('status')
  if (status) {
    if (!STATUS_VALUES.includes(status)) {
      errors.push(`Invalid status '${status}'. Must be one of: ${STATUS_VALUES.join(', ')}`)
    } else {
      params.status = status
    }
  }
  
  // limit - number, default 50, max 100
  const limitStr = searchParams.get('limit')
  let limit = DEFAULT_LIMIT
  if (limitStr) {
    const parsed = parseInt(limitStr, 10)
    if (isNaN(parsed) || parsed < 1) {
      errors.push('limit must be a positive integer')
    } else {
      limit = Math.min(parsed, MAX_LIMIT)
    }
  }
  params.limit = limit
  
  // skip - number, default 0
  const skipStr = searchParams.get('skip')
  let skip = 0
  if (skipStr) {
    const parsed = parseInt(skipStr, 10)
    if (isNaN(parsed) || parsed < 0) {
      errors.push('skip must be a non-negative integer')
    } else {
      skip = parsed
    }
  }
  params.skip = skip
  
  // since - ISO date string
  const since = searchParams.get('since')
  if (since) {
    const date = new Date(since)
    if (isNaN(date.getTime())) {
      errors.push('since must be a valid ISO date string')
    } else {
      params.since = date
    }
  }
  
  // until - ISO date string
  const until = searchParams.get('until')
  if (until) {
    const date = new Date(until)
    if (isNaN(date.getTime())) {
      errors.push('until must be a valid ISO date string')
    } else {
      params.until = date
    }
  }
  
  return { params, errors }
}

/**
 * Build MongoDB query from parsed parameters
 */
function buildQuery(params) {
  const query = {}
  
  if (params.requestId) query.requestId = params.requestId
  if (params.businessId) query.businessId = params.businessId
  if (params.tool) query.tool = params.tool
  if (params.actor) query.actor = params.actor
  if (params.status) query.status = params.status
  
  // Date range filter
  if (params.since || params.until) {
    query.executedAt = {}
    if (params.since) query.executedAt.$gte = params.since
    if (params.until) query.executedAt.$lte = params.until
  }
  
  return query
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request) {
  const startTime = Date.now()
  
  try {
    // 0. RATE LIMITING FIRST (before auth)
    const rateLimit = await checkRateLimitWithRequest(request, 'logs')
    
    if (!rateLimit.allowed) {
      log('warn', `Rate limit exceeded for caller=${rateLimit.caller}`)
      return NextResponse.json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        },
        _meta: { version: VERSION }
      }, { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((Date.now() + rateLimit.resetIn) / 1000))
        }
      })
    }
    
    // 1. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`)
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'AUTH_FAILED', 
          message: auth.error,
          help: auth.help
        },
        _meta: { version: VERSION }
      }, { status: 401 })
    }
    
    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const { params, errors } = parseQueryParams(searchParams)
    
    if (errors.length > 0) {
      log('warn', 'Invalid query parameters', { errors })
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Invalid query parameters',
          details: errors
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 3. Connect to database
    const database = await connect()
    const collection = database.collection(COLLECTION_NAME)
    
    // 4. Build query
    const query = buildQuery(params)
    
    log('info', 'Querying ops event logs', { 
      query: JSON.stringify(query),
      limit: params.limit,
      skip: params.skip,
      keyId: auth.keyId
    })
    
    // 5. Execute query with pagination
    const [logs, total] = await Promise.all([
      collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(params.skip)
        .limit(params.limit)
        .toArray(),
      collection.countDocuments(query)
    ])
    
    // 6. Calculate pagination info
    const hasMore = params.skip + logs.length < total
    
    // 7. Clean up logs for response (remove MongoDB _id)
    const cleanedLogs = logs.map(log => {
      const { _id, ...rest } = log
      return rest
    })
    
    const durationMs = Date.now() - startTime
    
    log('info', `Returned ${logs.length} logs`, { 
      total, 
      durationMs,
      keyId: auth.keyId 
    })
    
    return NextResponse.json({
      ok: true,
      logs: cleanedLogs,
      pagination: {
        total,
        limit: params.limit,
        skip: params.skip,
        returned: logs.length,
        hasMore
      },
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    log('error', `Unhandled error: ${error.message}`, {
      stack: error.stack?.split('\n').slice(0, 3).join(' | ')
    })
    
    return NextResponse.json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        details: { message: error.message }
      },
      _meta: { version: VERSION }
    }, { status: 500 })
  }
}

// ============================================================================
// OPTIONS Handler - CORS
// ============================================================================

export async function OPTIONS() {
  return new Response(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-book8-internal-secret'
    }
  })
}
