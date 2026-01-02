/**
 * POST /api/internal/ops/execute
 * GET  /api/internal/ops/execute (list tools & health check)
 * 
 * Ops Control Plane Executor Endpoint
 * 
 * Purpose:
 * Execute ops tools with schema validation, idempotency, and audit logging.
 * 
 * Authentication:
 * Requires x-book8-internal-secret header matching OPS_INTERNAL_SECRET env var.
 * 
 * Request Formats Supported:
 * 
 * 1. Nested args:
 * {
 *   "requestId": "uuid",
 *   "tool": "tenant.ensure",
 *   "dryRun": false,
 *   "args": { "businessId": "..." }
 * }
 * 
 * 2. Nested input (n8n style):
 * {
 *   "requestId": "uuid",
 *   "tool": "tenant.ensure",
 *   "dryRun": false,
 *   "input": { "businessId": "..." }
 * }
 * 
 * 3. Flat top-level args:
 * {
 *   "requestId": "uuid",
 *   "tool": "tenant.ensure",
 *   "dryRun": false,
 *   "businessId": "..."
 * }
 * 
 * Response:
 * {
 *   "ok": true/false,
 *   "requestId": "...",
 *   "tool": "...",
 *   "dryRun": true/false,
 *   "result": { ... },
 *   "error": { "code": "...", "message": "...", "details": any, "help": "..." }?,
 *   "executedAt": "ISO timestamp",
 *   "durationMs": number,
 *   "_meta": { "cached": boolean, "source": "..." }
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { z } from 'zod'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  initializeOps,
  isToolAllowed,
  validateToolArgs,
  executeTool,
  getToolNames,
  createAuditEntry,
  saveAuditLog,
  getCachedResult,
  storeResult,
  acquireLock,
  releaseLock
} from '@/lib/ops'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops]'
const VERSION = 'v1.2.0'

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitMap = new Map()
const RATE_LIMIT = {
  windowMs: 60000,  // 1 minute window
  maxRequests: 30,  // 30 requests per minute per IP
}

/**
 * Check if request is within rate limit
 * @param {string} identifier - IP address or other identifier
 * @returns {boolean} - true if allowed, false if rate limited
 */
function checkRateLimit(identifier) {
  const now = Date.now()
  const userRequests = rateLimitMap.get(identifier) || []
  
  // Remove requests outside the current window
  const validRequests = userRequests.filter(
    timestamp => now - timestamp < RATE_LIMIT.windowMs
  )
  
  if (validRequests.length >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: RATE_LIMIT.windowMs }
  }
  
  validRequests.push(now)
  rateLimitMap.set(identifier, validRequests)
  
  // Cleanup old entries periodically (1% chance per request)
  if (Math.random() < 0.01) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const valid = timestamps.filter(t => now - t < RATE_LIMIT.windowMs)
      if (valid.length === 0) {
        rateLimitMap.delete(key)
      } else {
        rateLimitMap.set(key, valid)
      }
    }
  }
  
  return { 
    allowed: true, 
    remaining: RATE_LIMIT.maxRequests - validRequests.length,
    resetIn: RATE_LIMIT.windowMs 
  }
}

// ============================================================================
// Security: Constant-Time Secret Comparison
// ============================================================================

/**
 * Constant-time secret comparison to prevent timing attacks
 * @param {string} provided - The secret provided in the request
 * @param {string} expected - The expected secret from environment
 * @returns {boolean} - true if secrets match
 */
function verifySecret(provided, expected) {
  if (!provided || !expected) {
    // Still do a dummy comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  const providedBuffer = Buffer.from(provided, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  
  // If lengths differ, do a dummy comparison to maintain constant time
  if (providedBuffer.length !== expectedBuffer.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
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
// Logging Utilities
// ============================================================================

function log(requestId, level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const prefix = requestId ? `${LOG_PREFIX}:${requestId}` : LOG_PREFIX
  const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  
  const logFn = level === 'error' ? console.error : console.log
  logFn(`${timestamp} ${prefix} [${level.toUpperCase()}] ${message}${dataStr}`)
}

function logRequest(requestId, tool, dryRun, args, source) {
  log(requestId, 'info', `Request received`, {
    tool,
    dryRun,
    argsFormat: source,
    argKeys: Object.keys(args)
  })
}

function logSuccess(requestId, tool, durationMs, resultSummary) {
  log(requestId, 'info', `Execution successful`, {
    tool,
    durationMs,
    summary: resultSummary
  })
}

function logError(requestId, code, message, details) {
  log(requestId, 'error', `Execution failed: ${code}`, {
    message,
    details: typeof details === 'object' ? JSON.stringify(details) : details
  })
}

// ============================================================================
// Request Schema & Parsing
// ============================================================================

const RequestSchema = z.object({
  requestId: z.string().min(1, 'requestId is required'),
  dryRun: z.boolean().optional().default(false),
  tool: z.string().min(1, 'tool is required'),
  args: z.record(z.any()).optional(),
  input: z.record(z.any()).optional(),
  businessId: z.string().optional(),
  name: z.string().optional(),
  actor: z.object({
    type: z.enum(['system', 'user']),
    id: z.string()
  }).optional()
})

/**
 * Extract tool arguments from request body
 * Returns { args, source } where source indicates which format was used
 */
function extractToolArgs(body) {
  // Priority 1: nested args object
  if (body.args && Object.keys(body.args).length > 0) {
    return { args: body.args, source: 'args' }
  }
  
  // Priority 2: nested input object (n8n style)
  if (body.input && Object.keys(body.input).length > 0) {
    return { args: body.input, source: 'input' }
  }
  
  // Priority 3: flat args from top level
  const envelopeFields = ['requestId', 'dryRun', 'tool', 'args', 'input', 'actor']
  const flatArgs = {}
  
  for (const [key, value] of Object.entries(body)) {
    if (!envelopeFields.includes(key) && value !== undefined) {
      flatArgs[key] = value
    }
  }
  
  return { args: flatArgs, source: 'flat' }
}

// ============================================================================
// Authentication
// ============================================================================

function verifyAuth(request) {
  const opsSecret = env.OPS_INTERNAL_SECRET || env.ADMIN_TOKEN
  
  if (!opsSecret) {
    return { 
      valid: false, 
      error: 'OPS_INTERNAL_SECRET not configured',
      help: 'Set OPS_INTERNAL_SECRET environment variable in Vercel'
    }
  }
  
  const providedSecret = request.headers.get('x-book8-internal-secret')
  
  if (!providedSecret) {
    return { 
      valid: false, 
      error: 'Missing x-book8-internal-secret header',
      help: 'Add header: x-book8-internal-secret: <your-secret>'
    }
  }
  
  // Use constant-time comparison to prevent timing attacks
  if (!verifySecret(providedSecret, opsSecret)) {
    return { 
      valid: false, 
      error: 'Invalid internal secret',
      help: 'Verify the secret matches OPS_INTERNAL_SECRET in Vercel'
    }
  }
  
  return { valid: true }
}

// ============================================================================
// Response Builders
// ============================================================================

function errorResponse(requestId, tool, dryRun, code, message, details = null, help = null, status = 400) {
  const error = { code, message }
  if (details) error.details = details
  if (help) error.help = help
  
  logError(requestId, code, message, details)
  
  return NextResponse.json({
    ok: false,
    requestId: requestId || 'unknown',
    tool: tool || 'unknown',
    dryRun,
    result: null,
    error,
    _meta: {
      version: VERSION,
      timestamp: new Date().toISOString()
    }
  }, { status })
}

function successResponse(requestId, tool, dryRun, result, startedAt, cached = false) {
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()
  
  logSuccess(requestId, tool, durationMs, result.summary || 'completed')
  
  return NextResponse.json({
    ok: result.ok !== false,
    requestId,
    tool,
    dryRun,
    result,
    error: result.error || null,
    executedAt: completedAt.toISOString(),
    durationMs,
    _meta: {
      version: VERSION,
      cached,
      timestamp: completedAt.toISOString()
    }
  })
}

// ============================================================================
// Error Help Messages
// ============================================================================

const ERROR_HELP = {
  AUTH_FAILED: 'Verify x-book8-internal-secret header matches OPS_INTERNAL_SECRET env var',
  INVALID_JSON: 'Check JSON syntax - ensure proper quoting and structure',
  VALIDATION_ERROR: 'Required fields: requestId (string), tool (string). Optional: dryRun (boolean)',
  TOOL_NOT_ALLOWED: 'Use GET /api/internal/ops/execute to list available tools',
  ARGS_VALIDATION_ERROR: 'Check tool documentation for required arguments. Most tools require businessId.',
  REQUEST_IN_PROGRESS: 'This requestId is being processed. Use a unique requestId for new requests.',
  INTERNAL_ERROR: 'Check Vercel logs for details. If persistent, contact support.'
}

// ============================================================================
// POST Handler - Execute Tool
// ============================================================================

export async function POST(request) {
  const startedAt = new Date()
  let requestId = null
  let tool = null
  let dryRun = false
  let actor = null
  let database = null
  let argsSource = 'unknown'
  
  try {
    // Initialize ops tools
    initializeOps()
    
    // 1. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      log(null, 'warn', `Auth failed: ${auth.error}`)
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'AUTH_FAILED', 
          message: auth.error,
          help: auth.help || ERROR_HELP.AUTH_FAILED
        },
        _meta: { version: VERSION }
      }, { status: 401 })
    }
    
    // 2. Parse request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return errorResponse(
        null, null, false,
        'INVALID_JSON',
        'Invalid JSON body',
        { parseError: e.message },
        ERROR_HELP.INVALID_JSON
      )
    }
    
    // 3. Validate request envelope
    const parseResult = RequestSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
      return errorResponse(
        body.requestId || null,
        body.tool || null,
        false,
        'VALIDATION_ERROR',
        'Request validation failed',
        errors,
        ERROR_HELP.VALIDATION_ERROR
      )
    }
    
    const validatedRequest = parseResult.data
    requestId = validatedRequest.requestId
    tool = validatedRequest.tool
    dryRun = validatedRequest.dryRun
    actor = validatedRequest.actor || { type: 'system', id: 'n8n-workflow' }
    
    // 4. Extract args from multiple possible formats
    const { args, source } = extractToolArgs(body)
    argsSource = source
    
    logRequest(requestId, tool, dryRun, args, source)
    
    // 5. Connect to database
    database = await connect()
    
    // 6. Check idempotency - return cached result if exists
    const cachedResult = await getCachedResult(database, requestId)
    if (cachedResult) {
      log(requestId, 'info', 'Returning cached result (idempotent)')
      // Add meta to cached response
      cachedResult._meta = {
        ...cachedResult._meta,
        cached: true,
        originalExecutedAt: cachedResult.executedAt
      }
      return NextResponse.json(cachedResult)
    }
    
    // 7. Acquire lock to prevent concurrent execution
    const lockAcquired = await acquireLock(database, requestId)
    if (!lockAcquired) {
      return errorResponse(
        requestId, tool, dryRun,
        'REQUEST_IN_PROGRESS',
        'This request is already being processed',
        { requestId },
        ERROR_HELP.REQUEST_IN_PROGRESS,
        409
      )
    }
    
    try {
      // 8. Validate tool is allowlisted
      if (!isToolAllowed(tool)) {
        const availableTools = getToolNames()
        
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { code: 'TOOL_NOT_ALLOWED', message: `Tool '${tool}' is not in the allowlist` },
          startedAt,
          completedAt: new Date()
        }))
        
        return errorResponse(
          requestId, tool, dryRun,
          'TOOL_NOT_ALLOWED',
          `Tool '${tool}' is not in the allowlist`,
          { availableTools, requestedTool: tool },
          ERROR_HELP.TOOL_NOT_ALLOWED
        )
      }
      
      // 9. Validate tool arguments
      const argsValidation = validateToolArgs(tool, args)
      if (!argsValidation.valid) {
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { code: 'ARGS_VALIDATION_ERROR', message: 'Arguments validation failed' },
          startedAt,
          completedAt: new Date()
        }))
        
        return errorResponse(
          requestId, tool, dryRun,
          'ARGS_VALIDATION_ERROR',
          'Tool arguments validation failed',
          {
            errors: argsValidation.errors,
            receivedArgs: Object.keys(args),
            argsFormat: argsSource
          },
          ERROR_HELP.ARGS_VALIDATION_ERROR
        )
      }
      
      // 10. Execute tool
      log(requestId, 'info', `Executing tool: ${tool}`, { dryRun })
      
      const ctx = {
        db: database,
        dryRun,
        requestId,
        actor,
        startedAt
      }
      
      const result = await executeTool(tool, argsValidation.data, ctx)
      const completedAt = new Date()
      
      // 11. Save audit log
      await saveAuditLog(database, createAuditEntry({
        requestId, 
        tool, 
        args: argsValidation.data, 
        actor, 
        dryRun,
        status: result.ok !== false ? 'succeeded' : 'failed',
        result,
        startedAt,
        completedAt
      }))
      
      // 12. Build and cache response
      const response = {
        ok: result.ok !== false,
        requestId,
        tool,
        dryRun,
        result,
        error: result.error || null,
        executedAt: completedAt.toISOString(),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        _meta: {
          version: VERSION,
          cached: false,
          argsFormat: argsSource
        }
      }
      
      await storeResult(database, requestId, response)
      
      logSuccess(requestId, tool, response.durationMs, result.summary || 'completed')
      
      return NextResponse.json(response)
      
    } finally {
      await releaseLock(database, requestId)
    }
    
  } catch (error) {
    log(requestId, 'error', `Unhandled error: ${error.message}`, { 
      stack: error.stack?.split('\n').slice(0, 3).join(' | ')
    })
    
    // Try to save audit log
    if (database && requestId) {
      try {
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args: {}, actor, dryRun,
          status: 'failed',
          error: { code: 'INTERNAL_ERROR', message: error.message },
          startedAt,
          completedAt: new Date()
        }))
      } catch (auditError) {
        log(requestId, 'error', `Failed to save audit log: ${auditError.message}`)
      }
    }
    
    return errorResponse(
      requestId,
      tool,
      dryRun,
      'INTERNAL_ERROR',
      'An internal error occurred',
      { 
        message: error.message,
        type: error.constructor.name
      },
      ERROR_HELP.INTERNAL_ERROR,
      500
    )
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

// ============================================================================
// GET Handler - List Tools & Health Check
// ============================================================================

export async function GET(request) {
  const auth = verifyAuth(request)
  if (!auth.valid) {
    return NextResponse.json({
      ok: false,
      error: { 
        code: 'AUTH_FAILED', 
        message: auth.error,
        help: auth.help
      }
    }, { status: 401 })
  }
  
  initializeOps()
  
  const tools = getToolNames()
  
  // Build tool info with descriptions
  const toolInfo = tools.map(name => ({
    name,
    requiredArgs: name.includes('tenant') || name.includes('billing') || name.includes('voice') 
      ? ['businessId'] 
      : []
  }))
  
  return NextResponse.json({
    ok: true,
    version: VERSION,
    tools: toolInfo,
    requestFormats: [
      { format: 'args', example: '{ "tool": "...", "args": { "businessId": "..." } }' },
      { format: 'input', example: '{ "tool": "...", "input": { "businessId": "..." } }' },
      { format: 'flat', example: '{ "tool": "...", "businessId": "..." }' }
    ],
    documentation: {
      api: '/docs/ops-control-plane-v1.md',
      n8n: '/docs/n8n-integration-guide.md'
    },
    health: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })
}
