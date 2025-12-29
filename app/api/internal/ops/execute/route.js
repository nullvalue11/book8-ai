/**
 * POST /api/internal/ops/execute
 * 
 * Ops Control Plane Executor Endpoint
 * 
 * Purpose:
 * Execute ops tools with schema validation, idempotency, and audit logging.
 * 
 * Authentication:
 * Requires x-book8-internal-secret header matching OPS_INTERNAL_SECRET env var.
 * 
 * Request:
 * {
 *   "requestId": "uuid/string (required)",
 *   "dryRun": boolean (default false),
 *   "tool": "string (required, must be allowlisted)",
 *   "args": { ... } (required, tool-specific),
 *   "actor": { "type": "system|user", "id": "string" } (optional)
 * }
 * 
 * Response:
 * {
 *   "ok": true/false,
 *   "requestId": "...",
 *   "tool": "...",
 *   "dryRun": true/false,
 *   "result": { ... },
 *   "error": { "code": "...", "message": "...", "details": any }?
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { z } from 'zod'
import { env } from '@/lib/env'
import {
  initializeOps,
  isToolAllowed,
  validateToolArgs,
  executeTool,
  getToolNames,
  createAuditEntry,
  saveAuditLog,
  getAuditLog,
  getCachedResult,
  storeResult,
  acquireLock,
  releaseLock
} from '@/lib/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

// Request schema
const RequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  dryRun: z.boolean().optional().default(false),
  tool: z.string().min(1, 'tool is required'),
  args: z.record(z.any()).optional().default({}),
  actor: z.object({
    type: z.enum(['system', 'user']),
    id: z.string()
  }).optional()
})

/**
 * Verify internal secret authentication
 */
function verifyAuth(request) {
  const opsSecret = env.OPS_INTERNAL_SECRET || env.ADMIN_TOKEN
  
  if (!opsSecret) {
    return { valid: false, error: 'OPS_INTERNAL_SECRET not configured' }
  }
  
  const providedSecret = request.headers.get('x-book8-internal-secret')
  
  if (!providedSecret) {
    return { valid: false, error: 'Missing x-book8-internal-secret header' }
  }
  
  if (providedSecret !== opsSecret) {
    return { valid: false, error: 'Invalid internal secret' }
  }
  
  return { valid: true }
}

/**
 * Build error response
 */
function errorResponse(requestId, tool, dryRun, code, message, details = null, status = 400) {
  return NextResponse.json({
    ok: false,
    requestId,
    tool,
    dryRun,
    result: null,
    error: { code, message, details }
  }, { status })
}

/**
 * Build success response
 */
function successResponse(requestId, tool, dryRun, result) {
  return NextResponse.json({
    ok: true,
    requestId,
    tool,
    dryRun,
    result,
    error: null
  })
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(request) {
  const startedAt = new Date()
  let requestId = null
  let tool = null
  let dryRun = false
  let actor = null
  let database = null
  
  try {
    // Initialize ops tools
    initializeOps()
    
    // 1. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      console.log(`[ops] Auth failed: ${auth.error}`)
      return NextResponse.json(
        { ok: false, error: { code: 'AUTH_FAILED', message: auth.error } },
        { status: 401 }
      )
    }
    
    // 2. Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      )
    }
    
    const parseResult = RequestSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message
      }))
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: errors } },
        { status: 400 }
      )
    }
    
    const validatedRequest = parseResult.data
    requestId = validatedRequest.requestId
    tool = validatedRequest.tool
    dryRun = validatedRequest.dryRun
    actor = validatedRequest.actor || { type: 'system', id: 'ops-executor' }
    const args = validatedRequest.args
    
    console.log(`[ops:${requestId}] Received request: tool=${tool}, dryRun=${dryRun}`)
    
    // 3. Connect to database
    database = await connect()
    
    // 4. Check idempotency - return cached result if exists
    const cachedResult = await getCachedResult(database, requestId)
    if (cachedResult) {
      console.log(`[ops:${requestId}] Returning cached result (idempotent)`)
      return NextResponse.json(cachedResult)
    }
    
    // 5. Acquire lock to prevent concurrent execution
    const lockAcquired = await acquireLock(database, requestId)
    if (!lockAcquired) {
      console.log(`[ops:${requestId}] Request already in progress`)
      return errorResponse(
        requestId, tool, dryRun,
        'REQUEST_IN_PROGRESS',
        'This request is already being processed',
        null, 409
      )
    }
    
    try {
      // 6. Validate tool is allowlisted
      if (!isToolAllowed(tool)) {
        console.log(`[ops:${requestId}] Tool not allowed: ${tool}`)
        
        const auditEntry = createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { code: 'TOOL_NOT_ALLOWED', message: `Tool '${tool}' is not in the allowlist` },
          startedAt,
          completedAt: new Date()
        })
        await saveAuditLog(database, auditEntry)
        
        return errorResponse(
          requestId, tool, dryRun,
          'TOOL_NOT_ALLOWED',
          `Tool '${tool}' is not in the allowlist. Available tools: ${getToolNames().join(', ')}`,
          { availableTools: getToolNames() }
        )
      }
      
      // 7. Validate tool arguments against schema
      const argsValidation = validateToolArgs(tool, args)
      if (!argsValidation.valid) {
        console.log(`[ops:${requestId}] Args validation failed:`, argsValidation.errors)
        
        const auditEntry = createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { code: 'ARGS_VALIDATION_ERROR', message: 'Arguments validation failed' },
          startedAt,
          completedAt: new Date()
        })
        await saveAuditLog(database, auditEntry)
        
        return errorResponse(
          requestId, tool, dryRun,
          'ARGS_VALIDATION_ERROR',
          'Tool arguments validation failed',
          argsValidation.errors
        )
      }
      
      // 8. Execute tool
      console.log(`[ops:${requestId}] Executing tool: ${tool}`)
      
      const ctx = {
        db: database,
        dryRun,
        requestId,
        actor,
        startedAt
      }
      
      const result = await executeTool(tool, argsValidation.data, ctx)
      const completedAt = new Date()
      
      console.log(`[ops:${requestId}] Tool execution complete. ok=${result.ok}`)
      
      // 9. Create audit log
      const auditEntry = createAuditEntry({
        requestId, tool, args: argsValidation.data, actor, dryRun,
        status: 'succeeded',
        result,
        startedAt,
        completedAt
      })
      await saveAuditLog(database, auditEntry)
      
      // 10. Build and cache response
      const response = {
        ok: result.ok !== false,
        requestId,
        tool,
        dryRun,
        result,
        error: result.error || null,
        executedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime()
      }
      
      await storeResult(database, requestId, response)
      
      return NextResponse.json(response)
      
    } finally {
      // Release lock
      await releaseLock(database, requestId)
    }
    
  } catch (error) {
    console.error(`[ops:${requestId || 'unknown'}] Unhandled error:`, error)
    
    // Try to save audit log for failed execution
    if (database && requestId) {
      try {
        const auditEntry = createAuditEntry({
          requestId, tool, args: {}, actor, dryRun,
          status: 'failed',
          error: { code: 'INTERNAL_ERROR', message: error.message },
          startedAt,
          completedAt: new Date()
        })
        await saveAuditLog(database, auditEntry)
      } catch (auditError) {
        console.error(`[ops:${requestId}] Failed to save audit log:`, auditError)
      }
    }
    
    return errorResponse(
      requestId || 'unknown',
      tool || 'unknown',
      dryRun,
      'INTERNAL_ERROR',
      'An internal error occurred',
      { message: error.message },
      500
    )
  }
}

// GET endpoint to list available tools
export async function GET(request) {
  const auth = verifyAuth(request)
  if (!auth.valid) {
    return NextResponse.json(
      { ok: false, error: { code: 'AUTH_FAILED', message: auth.error } },
      { status: 401 }
    )
  }
  
  initializeOps()
  
  return NextResponse.json({
    ok: true,
    tools: getToolNames(),
    documentation: '/docs/ops-control-plane-v1.md'
  })
}
