/**
 * GET /api/internal/ops/logs/:id
 * 
 * Retrieve a single ops call log by its ID (requestId).
 * 
 * Path Parameters:
 * - id (required): The unique request identifier
 * 
 * Response (found):
 * {
 *   ok: true,
 *   log: {
 *     id: "...",
 *     tool: "tenant.bootstrap",
 *     input: {...},
 *     meta: {...},
 *     result: {...},
 *     status: "success",
 *     error: null,
 *     duration: 123,
 *     timestamp: "..."
 *   },
 *   _meta: {...}
 * }
 * 
 * Response (not found):
 * {
 *   ok: false,
 *   error: { code: "NOT_FOUND", message: "Log not found" },
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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/logs/:id]'
const VERSION = 'v1.0.0'

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

function getApiKeyScopes() {
  const keys = {}
  
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'ops.logs.read', 'tenant.*', 'voice.*', 'billing.read']
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
// GET Handler
// ============================================================================

export async function GET(request, { params }) {
  const startTime = Date.now()
  const { id } = await params
  
  try {
    // 1. Validate id parameter
    if (!id || typeof id !== 'string' || id.trim() === '') {
      log('warn', 'Missing or invalid id parameter')
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'id parameter is required',
          help: 'Provide a valid log id (requestId) in the URL path'
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 2. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`, { id })
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
    
    log('info', `Looking up log`, { id, keyId: auth.keyId })
    
    // 3. Connect to database
    const database = await connect()
    const collection = database.collection(COLLECTION_NAME)
    
    // 4. Find log by requestId
    const logEntry = await collection.findOne({ requestId: id })
    
    const durationMs = Date.now() - startTime
    
    // 5. Handle not found
    if (!logEntry) {
      log('info', `Log not found`, { id, durationMs })
      return NextResponse.json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Log not found',
          id
        },
        _meta: {
          version: VERSION,
          durationMs,
          timestamp: new Date().toISOString()
        }
      }, { status: 404 })
    }
    
    // 6. Clean up response (remove MongoDB _id)
    const { _id, ...cleanLog } = logEntry
    
    // 7. Transform to standardized response format as per requirements
    const response = {
      ok: true,
      log: {
        // Use 'id' as the standardized identifier
        id: cleanLog.requestId,
        tool: cleanLog.tool,
        // Input payload (full request payload)
        input: cleanLog.input || cleanLog.metadata?.payload || null,
        // Meta information about the call
        meta: {
          requestId: cleanLog.requestId,
          businessId: cleanLog.businessId,
          actor: cleanLog.actor,
          mode: cleanLog.mode || 'execute',
          dryRun: cleanLog.metadata?.dryRun || false,
          argsFormat: cleanLog.metadata?.argsFormat,
          keyId: cleanLog.metadata?.keyId
        },
        // Result/output from the tool execution
        result: cleanLog.result || {
          ready: cleanLog.metadata?.ready,
          readyMessage: cleanLog.metadata?.readyMessage,
          summary: cleanLog.metadata?.summary,
          checklist: cleanLog.metadata?.checklist,
          recommendations: cleanLog.metadata?.recommendations,
          stats: cleanLog.metadata?.stats
        },
        // Execution status
        status: cleanLog.status,
        // Error details if any
        error: cleanLog.metadata?.error || null,
        // Duration in milliseconds
        duration: cleanLog.durationMs,
        // Timestamp of execution
        timestamp: cleanLog.executedAt?.toISOString ? cleanLog.executedAt.toISOString() : cleanLog.executedAt,
        // Additional timestamps
        createdAt: cleanLog.createdAt?.toISOString ? cleanLog.createdAt.toISOString() : cleanLog.createdAt,
        updatedAt: cleanLog.updatedAt?.toISOString ? cleanLog.updatedAt.toISOString() : cleanLog.updatedAt
      },
      // Include raw data for advanced use cases
      _raw: cleanLog,
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    }
    
    log('info', `Log found`, { 
      id, 
      tool: cleanLog.tool,
      status: cleanLog.status,
      durationMs 
    })
    
    return NextResponse.json(response)
    
  } catch (error) {
    log('error', `Unhandled error: ${error.message}`, {
      id,
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
