/**
 * POST /api/internal/ops/requests
 * GET /api/internal/ops/requests
 * 
 * Create and list approval requests for high-risk tool executions.
 * 
 * POST: Creates a new approval request
 * - Stores the request in ops_approval_requests collection
 * - Returns requestId and status
 * 
 * GET: Lists approval requests
 * - Query params: status, tool, requestedBy, limit, skip
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  createApprovalRequest,
  saveApprovalRequest,
  listApprovalRequests,
  countByStatus,
  COLLECTION_NAME
} from '@/lib/schemas/opsApprovalRequest'
import {
  getToolFromRegistry,
  isToolInRegistry
} from '@/lib/ops/tool-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/requests]'
const VERSION = 'v1.0.0'

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

function getApiKeyScopes() {
  const keys = {}
  
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'ops.requests.*', 'tenant.*', 'voice.*', 'billing.read']
  }
  
  if (env.OPS_KEY_ADMIN) {
    keys[env.OPS_KEY_ADMIN] = ['*']
  }
  
  if (env.OPS_INTERNAL_SECRET) {
    keys[env.OPS_INTERNAL_SECRET] = ['*']
  }
  
  if (env.ADMIN_TOKEN && Object.keys(keys).length === 0) {
    keys[env.ADMIN_TOKEN] = ['*']
  }
  
  return keys
}

function scopeMatches(allowedScope, requiredScope) {
  if (allowedScope === '*') return true
  if (allowedScope === requiredScope) return true
  
  if (allowedScope.endsWith('.*')) {
    const prefix = allowedScope.slice(0, -2)
    return requiredScope.startsWith(prefix + '.')
  }
  
  return false
}

function hasScope(allowedScopes, requiredScope) {
  return allowedScopes.some(scope => scopeMatches(scope, requiredScope))
}

// ============================================================================
// Security
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

function verifyAuth(request, requiredScope) {
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
  
  if (!hasScope(matchedScopes, requiredScope)) {
    return {
      valid: false,
      error: `API key does not have permission for this action`,
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
// POST Handler - Create Approval Request
// ============================================================================

export async function POST(request) {
  const startTime = Date.now()
  
  try {
    // 1. Verify authentication
    const auth = verifyAuth(request, 'ops.requests.create')
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
    
    // 2. Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 3. Validate required fields
    const { tool, payload, plan, requestedBy, meta } = body
    
    if (!tool || typeof tool !== 'string') {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'tool is required and must be a string'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'payload is required and must be an object'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    if (!requestedBy || typeof requestedBy !== 'string') {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'requestedBy is required and must be a string'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 4. Validate tool exists in registry
    if (!isToolInRegistry(tool)) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool '${tool}' not found in registry`,
          help: 'Check GET /api/internal/ops/tools for available tools'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 5. Get tool metadata
    const toolMeta = getToolFromRegistry(tool)
    
    // 6. Connect to database
    const database = await connect()
    
    // 7. Create approval request
    const approvalRequest = createApprovalRequest({
      tool,
      payload,
      plan: plan || { note: 'Plan not provided - will be generated on execution' },
      requestedBy,
      meta: {
        ...meta,
        toolRisk: toolMeta?.risk,
        toolRequiresApproval: toolMeta?.requiresApproval,
        keyId: auth.keyId
      }
    })
    
    // 8. Save to database
    await saveApprovalRequest(database, approvalRequest)
    
    const durationMs = Date.now() - startTime
    
    log('info', `Approval request created`, {
      requestId: approvalRequest.requestId,
      tool,
      requestedBy,
      durationMs
    })
    
    return NextResponse.json({
      ok: true,
      requestId: approvalRequest.requestId,
      status: approvalRequest.status,
      tool: approvalRequest.tool,
      payloadHash: approvalRequest.payloadHash,
      expiresAt: approvalRequest.expiresAt.toISOString(),
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    }, { status: 201 })
    
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
// GET Handler - List Approval Requests
// ============================================================================

export async function GET(request) {
  const startTime = Date.now()
  
  try {
    // 1. Verify authentication
    const auth = verifyAuth(request, 'ops.requests.read')
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
    const status = searchParams.get('status')
    const tool = searchParams.get('tool')
    const requestedBy = searchParams.get('requestedBy')
    const limitStr = searchParams.get('limit')
    const skipStr = searchParams.get('skip')
    
    const filters = {}
    if (status) filters.status = status
    if (tool) filters.tool = tool
    if (requestedBy) filters.requestedBy = requestedBy
    
    const options = {
      limit: limitStr ? parseInt(limitStr, 10) : 50,
      skip: skipStr ? parseInt(skipStr, 10) : 0
    }
    
    // 3. Connect to database
    const database = await connect()
    
    // 4. Get requests and counts
    const [requests, counts] = await Promise.all([
      listApprovalRequests(database, filters, options),
      countByStatus(database)
    ])
    
    // 5. Clean up response
    const cleanedRequests = requests.map(r => {
      const { _id, ...rest } = r
      return rest
    })
    
    const durationMs = Date.now() - startTime
    
    log('info', `Listed ${requests.length} approval requests`, {
      filters,
      durationMs,
      keyId: auth.keyId
    })
    
    return NextResponse.json({
      ok: true,
      requests: cleanedRequests,
      counts,
      pagination: {
        limit: options.limit,
        skip: options.skip,
        returned: cleanedRequests.length
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-book8-internal-secret'
    }
  })
}
