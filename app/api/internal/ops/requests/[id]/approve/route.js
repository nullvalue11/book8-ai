/**
 * POST /api/internal/ops/requests/:id/approve
 * 
 * Approve an approval request for high-risk tool execution.
 * 
 * Updates request status from 'pending' to 'approved'.
 * Stores approvedBy and approvedAt.
 * 
 * Request body:
 * {
 *   approvedBy: string (required)
 * }
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 * Required scope: ops.requests.approve
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  getApprovalRequest,
  updateApprovalRequest,
  validateStatusTransition
} from '@/lib/schemas/opsApprovalRequest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/requests/approve]'
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
      error: 'No API keys configured'
    }
  }
  
  const providedKey = request.headers.get('x-book8-internal-secret')
  
  if (!providedKey) {
    return { 
      valid: false, 
      error: 'Missing x-book8-internal-secret header'
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
    return { valid: false, error: 'Invalid API key' }
  }
  
  if (!hasScope(matchedScopes, requiredScope)) {
    return {
      valid: false,
      error: `API key does not have permission. Required scope: ${requiredScope}`
    }
  }
  
  return { valid: true, scopes: matchedScopes, keyId }
}

// ============================================================================
// POST Handler - Approve Request
// ============================================================================

export async function POST(request, { params }) {
  const startTime = Date.now()
  const { id: requestId } = await params
  
  try {
    // 1. Verify authentication
    const auth = verifyAuth(request, 'ops.requests.approve')
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`, { requestId })
      return NextResponse.json({
        ok: false,
        error: { code: 'AUTH_FAILED', message: auth.error },
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
        error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    const { approvedBy } = body
    
    if (!approvedBy || typeof approvedBy !== 'string') {
      return NextResponse.json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'approvedBy is required and must be a string' },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 3. Connect to database
    const database = await connect()
    
    // 4. Get the approval request
    const approvalRequest = await getApprovalRequest(database, requestId)
    
    if (!approvalRequest) {
      log('warn', `Approval request not found`, { requestId })
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'NOT_FOUND', 
          message: `Approval request '${requestId}' not found` 
        },
        _meta: { version: VERSION }
      }, { status: 404 })
    }
    
    // 5. Validate status transition
    const transition = validateStatusTransition(approvalRequest.status, 'approved')
    if (!transition.valid) {
      log('warn', `Invalid status transition`, { 
        requestId, 
        currentStatus: approvalRequest.status,
        error: transition.error 
      })
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'INVALID_TRANSITION', 
          message: transition.error,
          currentStatus: approvalRequest.status
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 6. Check if request has expired
    if (new Date() > new Date(approvalRequest.expiresAt)) {
      await updateApprovalRequest(database, requestId, { status: 'expired' })
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'REQUEST_EXPIRED', 
          message: 'Approval request has expired',
          expiredAt: approvalRequest.expiresAt
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 7. Update status to approved
    const now = new Date()
    await updateApprovalRequest(database, requestId, {
      status: 'approved',
      approvedBy,
      approvedAt: now
    })
    
    const durationMs = Date.now() - startTime
    
    log('info', `Approval request approved`, {
      requestId,
      tool: approvalRequest.tool,
      approvedBy,
      durationMs
    })
    
    return NextResponse.json({
      ok: true,
      requestId,
      status: 'approved',
      tool: approvalRequest.tool,
      approvedBy,
      approvedAt: now.toISOString(),
      nextStep: `POST /api/internal/ops/requests/${requestId}/execute to execute`,
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    })
    
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-book8-internal-secret'
    }
  })
}
