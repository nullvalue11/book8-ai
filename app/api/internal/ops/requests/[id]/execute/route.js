/**
 * POST /api/internal/ops/requests/:id/execute
 * 
 * Execute an approved request for high-risk tool execution.
 * 
 * - Re-validates payload hash matches
 * - Executes tool via tool-registry (real execution, not plan mode)
 * - Updates status to 'executed' with result
 * - Stores executedAt timestamp and result/error
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 * Required scope: ops.requests.execute
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  getApprovalRequest,
  updateApprovalRequest,
  validateStatusTransition,
  verifyPayloadHash
} from '@/lib/schemas/opsApprovalRequest'
import {
  getToolFromRegistry,
  validateToolInput
} from '@/lib/ops/tool-registry'
import {
  initializeOps,
  executeTool,
  validateToolArgs,
  createAuditEntry,
  saveAuditLog
} from '@/lib/ops'
import {
  createOpsEventLog,
  saveOpsEventLog
} from '@/lib/schemas/opsEventLog'
import { checkRateLimitWithRequest } from '@/api/internal/ops/_lib/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/requests/execute]'
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
    return { valid: false, error: 'No API keys configured' }
  }
  
  const providedKey = request.headers.get('x-book8-internal-secret')
  
  if (!providedKey) {
    return { valid: false, error: 'Missing x-book8-internal-secret header' }
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
    return { valid: false, error: `API key does not have permission. Required scope: ${requiredScope}` }
  }
  
  return { valid: true, scopes: matchedScopes, keyId }
}

// ============================================================================
// POST Handler - Execute Approved Request
// ============================================================================

export async function POST(request, { params }) {
  const startTime = Date.now()
  const { id: requestId } = await params
  
  try {
    // 1. Verify authentication
    const auth = verifyAuth(request, 'ops.requests.execute')
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`, { requestId })
      return NextResponse.json({
        ok: false,
        error: { code: 'AUTH_FAILED', message: auth.error },
        _meta: { version: VERSION }
      }, { status: 401 })
    }
    
    // 2. Connect to database
    const database = await connect()
    
    // 3. Get the approval request
    const approvalRequest = await getApprovalRequest(database, requestId)
    
    if (!approvalRequest) {
      log('warn', `Approval request not found`, { requestId })
      return NextResponse.json({
        ok: false,
        error: { code: 'NOT_FOUND', message: `Approval request '${requestId}' not found` },
        _meta: { version: VERSION }
      }, { status: 404 })
    }
    
    // 4. Validate status transition
    const transition = validateStatusTransition(approvalRequest.status, 'executed')
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
          currentStatus: approvalRequest.status,
          hint: approvalRequest.status === 'pending' 
            ? 'Request must be approved before execution. POST /api/internal/ops/requests/:id/approve first.'
            : undefined
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 5. Check if request has expired
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
    
    // 6. Re-validate payload hash for integrity
    const hashValid = verifyPayloadHash(approvalRequest.payload, approvalRequest.payloadHash)
    if (!hashValid) {
      log('error', `Payload hash mismatch - possible tampering`, { requestId })
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'INTEGRITY_ERROR', 
          message: 'Payload hash mismatch - request may have been tampered with',
          hint: 'Create a new approval request'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 7. Get tool from registry
    const tool = approvalRequest.tool
    const toolMeta = getToolFromRegistry(tool)
    
    if (!toolMeta) {
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'TOOL_NOT_FOUND', 
          message: `Tool '${tool}' not found in registry` 
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 8. Validate input against registry schema
    const inputValidation = validateToolInput(tool, approvalRequest.payload)
    if (!inputValidation.valid) {
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'VALIDATION_ERROR', 
          message: 'Input validation failed',
          errors: inputValidation.errors
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 9. Initialize ops and validate with Zod
    initializeOps()
    const argsValidation = validateToolArgs(tool, approvalRequest.payload)
    if (!argsValidation.valid) {
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'ARGS_VALIDATION_ERROR', 
          message: 'Tool arguments validation failed',
          errors: argsValidation.errors
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 10. Execute the tool
    log('info', `Executing approved request`, {
      requestId,
      tool,
      approvedBy: approvalRequest.approvedBy
    })
    
    const executionStartTime = Date.now()
    let result, executionError
    
    try {
      const ctx = {
        db: database,
        dryRun: false,
        requestId: `exec-${requestId}`,
        actor: { type: 'system', id: 'approval-executor' },
        startedAt: new Date(),
        approvalRequestId: requestId,
        approvedBy: approvalRequest.approvedBy
      }
      
      result = await executeTool(tool, argsValidation.data, ctx)
    } catch (execError) {
      executionError = {
        code: 'EXECUTION_ERROR',
        message: execError.message,
        type: execError.constructor?.name
      }
      log('error', `Tool execution failed`, { requestId, error: execError.message })
    }
    
    const executionDurationMs = Date.now() - executionStartTime
    const executedAt = new Date()
    
    // 11. Update approval request with result
    await updateApprovalRequest(database, requestId, {
      status: 'executed',
      executedAt,
      result: result || null,
      error: executionError || null,
      meta: {
        ...approvalRequest.meta,
        executionDurationMs,
        executedByKeyId: auth.keyId
      }
    })
    
    // 12. Save audit log
    try {
      await saveAuditLog(database, createAuditEntry({
        requestId: `exec-${requestId}`,
        tool,
        args: argsValidation.data,
        actor: { type: 'system', id: 'approval-executor' },
        dryRun: false,
        status: executionError ? 'failed' : 'succeeded',
        result: result || { error: executionError },
        startedAt: new Date(executionStartTime),
        completedAt: executedAt,
        keyId: auth.keyId,
        approvalRequestId: requestId
      }))
    } catch (auditError) {
      log('warn', `Failed to save audit log: ${auditError.message}`)
    }
    
    // 13. Emit event log
    try {
      const eventLog = createOpsEventLog({
        requestId: `exec-${requestId}`,
        tool,
        businessId: approvalRequest.payload?.businessId || null,
        status: executionError ? 'failed' : 'success',
        durationMs: executionDurationMs,
        executedAt,
        actor: 'system',
        metadata: {
          approvalRequestId: requestId,
          approvedBy: approvalRequest.approvedBy,
          dryRun: false,
          error: executionError
        }
      })
      saveOpsEventLog(database, eventLog).catch(() => {})
    } catch {
      // Ignore event log errors
    }
    
    const totalDurationMs = Date.now() - startTime
    
    log('info', `Approved request executed`, {
      requestId,
      tool,
      success: !executionError,
      durationMs: totalDurationMs
    })
    
    // 14. Return response
    if (executionError) {
      return NextResponse.json({
        ok: false,
        requestId,
        status: 'executed',
        tool,
        error: executionError,
        executedAt: executedAt.toISOString(),
        executionDurationMs,
        _meta: {
          version: VERSION,
          durationMs: totalDurationMs,
          timestamp: new Date().toISOString()
        }
      }, { status: 500 })
    }
    
    return NextResponse.json({
      ok: true,
      requestId,
      status: 'executed',
      tool,
      result,
      executedAt: executedAt.toISOString(),
      executionDurationMs,
      approvalDetails: {
        approvedBy: approvalRequest.approvedBy,
        approvedAt: approvalRequest.approvedAt
      },
      _meta: {
        version: VERSION,
        durationMs: totalDurationMs,
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
