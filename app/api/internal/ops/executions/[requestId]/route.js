/**
 * GET /api/internal/ops/executions/[requestId]
 * 
 * Retrieve a single ops execution by requestId.
 * 
 * Path Parameters:
 * - requestId (required): The unique request identifier
 * 
 * Response (found):
 * {
 *   ok: true,
 *   execution: {
 *     requestId: "...",
 *     tool: "tenant.bootstrap",
 *     status: "success",
 *     actor: "n8n",
 *     input: {...},
 *     output: {...},
 *     durationMs: 123,
 *     executedAt: "...",
 *     createdAt: "..."
 *   },
 *   _meta: {...}
 * }
 * 
 * Response (not found):
 * {
 *   ok: false,
 *   error: { code: "NOT_FOUND", message: "Execution not found" },
 *   _meta: {...}
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
import { COLLECTION_NAME } from '@/lib/schemas/opsEventLog'
import { checkRateLimitWithRequest } from '@/api/internal/ops/_lib/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/executions]'
const VERSION = 'v1.0.0'

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
      error: `API key does not have permission to read executions`,
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
// GET Handler
// ============================================================================

export async function GET(request, { params }) {
  const startTime = Date.now()
  const { requestId } = await params
  
  try {
    // 0. RATE LIMITING FIRST (before auth)
    const rateLimit = await checkRateLimitWithRequest(request, 'executions')
    
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
    
    // 1. Validate requestId parameter
    if (!requestId || typeof requestId !== 'string' || requestId.trim() === '') {
      log('warn', 'Missing or invalid requestId parameter')
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'requestId parameter is required',
          help: 'Provide a valid requestId in the URL path'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 2. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`, { requestId })
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
    
    log('info', `Looking up execution`, { requestId, keyId: auth.keyId })
    
    // 3. Connect to database
    const database = await connect()
    const collection = database.collection(COLLECTION_NAME)
    
    // 4. Find execution by requestId
    const execution = await collection.findOne({ requestId })
    
    const durationMs = Date.now() - startTime
    
    // 5. Handle not found
    if (!execution) {
      log('info', `Execution not found`, { requestId, durationMs })
      return NextResponse.json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Execution not found',
          requestId
        },
        _meta: {
          version: VERSION,
          durationMs,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 })
    }
    
    // 6. Clean up response (remove MongoDB _id)
    const { _id, ...cleanExecution } = execution
    
    // 7. Transform to cleaner response format
    const response = {
      ok: true,
      execution: {
        requestId: cleanExecution.requestId,
        tool: cleanExecution.tool,
        status: cleanExecution.status,
        actor: cleanExecution.actor,
        businessId: cleanExecution.businessId,
        durationMs: cleanExecution.durationMs,
        executedAt: cleanExecution.executedAt,
        createdAt: cleanExecution.createdAt,
        updatedAt: cleanExecution.updatedAt,
        // Include full metadata for detailed inspection
        input: cleanExecution.metadata?.argsFormat ? {
          format: cleanExecution.metadata.argsFormat,
          dryRun: cleanExecution.metadata.dryRun
        } : null,
        output: {
          ready: cleanExecution.metadata?.ready,
          readyMessage: cleanExecution.metadata?.readyMessage,
          summary: cleanExecution.metadata?.summary,
          checklist: cleanExecution.metadata?.checklist,
          recommendations: cleanExecution.metadata?.recommendations,
          stats: cleanExecution.metadata?.stats,
          error: cleanExecution.metadata?.error
        },
        // Include raw metadata for advanced use cases
        _rawMetadata: cleanExecution.metadata
      },
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    }
    
    log('info', `Execution found`, { 
      requestId, 
      tool: cleanExecution.tool,
      status: cleanExecution.status,
      durationMs 
    })
    
    return NextResponse.json(response)
    
  } catch (error) {
    log('error', `Unhandled error: ${error.message}`, {
      requestId,
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
