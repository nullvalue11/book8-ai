/**
 * POST /api/internal/ops/execute
 * GET  /api/internal/ops/execute (list tools & health check)
 * 
 * Ops Control Plane Executor Endpoint v1.3.0
 * 
 * Features:
 * - Scoped API keys (OPS_KEY_N8N, OPS_KEY_ADMIN, or legacy OPS_INTERNAL_SECRET)
 * - RequestId-based rate limiting (serverless-friendly)
 * - Timing-safe authentication
 * - Idempotency via MongoDB
 * - Full audit logging
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with a valid scoped API key.
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
const VERSION = 'v1.3.0'

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

/**
 * Tool scope requirements
 * Each tool declares what scope is needed to execute it
 */
const TOOL_SCOPES = {
  'tenant.ensure': 'tenant.write',
  'tenant.provisioningSummary': 'tenant.read',
  'tenant.bootstrap': 'tenant.write',
  'billing.validateStripeConfig': 'billing.read',
  'voice.smokeTest': 'voice.test',
}

/**
 * Get API key scopes from environment
 * Supports multiple keys with different permission levels
 */
function getApiKeyScopes() {
  const keys = {}
  
  // n8n automation key - limited to ops tasks
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'tenant.*', 'voice.*', 'billing.read']
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
 * Supports wildcards: '*' matches everything, 'tenant.*' matches 'tenant.read', 'tenant.write'
 */
function scopeMatches(allowedScope, requiredScope) {
  if (allowedScope === '*') return true
  if (allowedScope === requiredScope) return true
  
  // Check wildcard patterns like 'tenant.*'
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
// Rate Limiting (Key-based for serverless compatibility)
// ============================================================================

const rateLimitMap = new Map()

// Different rate limits for different key types
const RATE_LIMITS = {
  // Admin keys get higher limits
  admin: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 300,  // 300 requests per minute
  },
  // n8n automation keys get generous limits
  n8n: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 200,  // 200 requests per minute
  },
  // Default/legacy keys
  default: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 100,  // 100 requests per minute (increased from 30)
  }
}

/**
 * Get rate limit config based on key type
 */
function getRateLimitConfig(keyId) {
  if (keyId?.includes('admin')) return RATE_LIMITS.admin
  if (keyId?.includes('n8n')) return RATE_LIMITS.n8n
  return RATE_LIMITS.default
}

/**
 * Check if request is within rate limit
 * Uses API key prefix as identifier for serverless-friendly rate limiting
 * @param {string} identifier - API key prefix or requestId prefix
 * @param {string} keyType - Type of key for determining limits
 * @returns {object} - { allowed, remaining, resetIn, limit }
 */
function checkRateLimit(identifier, keyType = 'default') {
  const config = getRateLimitConfig(keyType)
  const now = Date.now()
  const requests = rateLimitMap.get(identifier) || []
  
  // Remove requests outside the current window
  const validRequests = requests.filter(
    timestamp => now - timestamp < config.windowMs
  )
  
  if (validRequests.length >= config.maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: config.windowMs,
      limit: config.maxRequests
    }
  }
  
  validRequests.push(now)
  rateLimitMap.set(identifier, validRequests)
  
  // Cleanup old entries periodically (1% chance per request)
  if (Math.random() < 0.01) {
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const valid = timestamps.filter(t => now - t < config.windowMs)
      if (valid.length === 0) {
        rateLimitMap.delete(key)
      } else {
        rateLimitMap.set(key, valid)
      }
    }
  }
  
  return { 
    allowed: true, 
    remaining: config.maxRequests - validRequests.length,
    resetIn: config.windowMs,
    limit: config.maxRequests
  }
}

/**
 * Get rate limit identifier from API key
 * Uses first 8 chars of key hash for privacy
 */
function getRateLimitIdentifier(apiKey) {
  if (!apiKey) return 'unknown'
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  return `key_${hash.substring(0, 8)}`
}

// ============================================================================
// Security: Constant-Time Secret Comparison
// ============================================================================

/**
 * Constant-time secret comparison to prevent timing attacks
 */
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

function logRequest(requestId, tool, dryRun, args, source, keyId) {
  log(requestId, 'info', `Request received`, {
    tool,
    dryRun,
    argsFormat: source,
    argKeys: Object.keys(args),
    keyId
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

// New format schema: { tool, payload, meta }
const MetaSchema = z.object({
  requestId: z.string().min(1, 'meta.requestId is required'),
  dryRun: z.boolean().optional().default(false),
  actor: z.object({
    type: z.enum(['system', 'user']),
    id: z.string()
  }).optional()
})

const NewRequestSchema = z.object({
  tool: z.string().min(1, 'tool is required'),
  payload: z.record(z.any()).default({}),
  meta: MetaSchema
})

// Legacy format schema (for backwards compatibility)
const LegacyRequestSchema = z.object({
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
 * Detect and parse request format
 * Supports both new format { tool, payload, meta } and legacy formats
 * @returns { tool, args, requestId, dryRun, actor, format }
 */
function parseRequest(body) {
  // Try new format first: { tool, payload, meta }
  if (body.meta && body.payload !== undefined) {
    const result = NewRequestSchema.safeParse(body)
    if (result.success) {
      return {
        valid: true,
        tool: result.data.tool,
        args: result.data.payload,
        requestId: result.data.meta.requestId,
        dryRun: result.data.meta.dryRun,
        actor: result.data.meta.actor || { type: 'system', id: 'n8n-workflow' },
        format: 'new'
      }
    }
    // Return validation errors for new format
    return {
      valid: false,
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      })),
      format: 'new'
    }
  }
  
  // Try legacy format
  const legacyResult = LegacyRequestSchema.safeParse(body)
  if (legacyResult.success) {
    const data = legacyResult.data
    // Extract args from legacy formats
    const { args, source } = extractLegacyArgs(body)
    return {
      valid: true,
      tool: data.tool,
      args,
      requestId: data.requestId,
      dryRun: data.dryRun,
      actor: data.actor || { type: 'system', id: 'n8n-workflow' },
      format: `legacy-${source}`
    }
  }
  
  // Neither format matched
  return {
    valid: false,
    errors: legacyResult.error.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
      code: e.code
    })),
    format: 'unknown'
  }
}

/**
 * Extract tool arguments from legacy request body formats
 */
function extractLegacyArgs(body) {
  // Nested args object
  if (body.args && Object.keys(body.args).length > 0) {
    return { args: body.args, source: 'args' }
  }
  
  // Nested input object (n8n style)
  if (body.input && Object.keys(body.input).length > 0) {
    return { args: body.input, source: 'input' }
  }
  
  // Flat args at top level
  const envelopeFields = ['requestId', 'dryRun', 'tool', 'args', 'input', 'actor', 'meta', 'payload']
  const flatArgs = {}
  
  for (const [key, value] of Object.entries(body)) {
    if (!envelopeFields.includes(key) && value !== undefined) {
      flatArgs[key] = value
    }
  }
  
  return { args: flatArgs, source: 'flat' }
}

// ============================================================================
// Authentication with Scoped Keys
// ============================================================================

/**
 * Verify authentication and return key info with scopes
 */
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
  
  // Find matching key using constant-time comparison
  let matchedScopes = null
  let keyId = null
  
  for (const [key, scopes] of Object.entries(apiKeys)) {
    if (verifySecret(providedKey, key)) {
      matchedScopes = scopes
      // Generate safe key identifier for logging
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
  
  return { 
    valid: true, 
    scopes: matchedScopes,
    keyId 
  }
}

/**
 * Check if the authenticated key has permission for a tool
 */
function checkToolPermission(scopes, tool) {
  const requiredScope = TOOL_SCOPES[tool] || 'ops.execute'
  
  if (hasScope(scopes, requiredScope)) {
    return { allowed: true }
  }
  
  // Also check for the generic ops.execute scope
  if (hasScope(scopes, 'ops.execute')) {
    return { allowed: true }
  }
  
  return { 
    allowed: false, 
    requiredScope,
    availableScopes: scopes
  }
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
  AUTH_FAILED: 'Verify x-book8-internal-secret header with valid API key',
  FORBIDDEN: 'Your API key does not have permission for this tool. Contact admin for access.',
  INVALID_JSON: 'Check JSON syntax - ensure proper quoting and structure',
  VALIDATION_ERROR: 'New format: { tool, payload: {...}, meta: { requestId, dryRun? } }. Legacy format: { tool, requestId, args/input/payload }',
  TOOL_NOT_ALLOWED: 'Use GET /api/internal/ops/execute to list available tools',
  ARGS_VALIDATION_ERROR: 'Check tool documentation for required arguments. Most tools require businessId.',
  REQUEST_IN_PROGRESS: 'This requestId is being processed. Use a unique requestId for new requests.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Wait 60 seconds before retrying.',
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
  let keyId = 'unknown'
  
  try {
    // Initialize ops tools
    initializeOps()
    
    // 0. Verify authentication first (to get key identifier for rate limiting)
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
    
    keyId = auth.keyId
    
    // 1. Rate limiting based on API key (serverless-friendly)
    const rateLimit = checkRateLimit(keyId, keyId)
    if (!rateLimit.allowed) {
      log(null, 'warn', `Rate limit exceeded for key: ${keyId}`)
      return NextResponse.json({
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          help: ERROR_HELP.RATE_LIMIT_EXCEEDED,
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
    
    // 3. Parse and validate request (supports both new and legacy formats)
    const parseResult = parseRequest(body)
    if (!parseResult.valid) {
      return errorResponse(
        body.meta?.requestId || body.requestId || null,
        body.tool || null,
        false,
        'VALIDATION_ERROR',
        'Request validation failed',
        { errors: parseResult.errors, detectedFormat: parseResult.format },
        ERROR_HELP.VALIDATION_ERROR
      )
    }
    
    requestId = parseResult.requestId
    tool = parseResult.tool
    dryRun = parseResult.dryRun
    actor = parseResult.actor
    const args = parseResult.args
    argsSource = parseResult.format
    
    logRequest(requestId, tool, dryRun, args, argsSource, keyId)
    
    // 5. Check tool permission based on API key scopes
    const permission = checkToolPermission(auth.scopes, tool)
    if (!permission.allowed) {
      log(requestId, 'warn', `Permission denied for tool: ${tool}`, {
        requiredScope: permission.requiredScope,
        keyId
      })
      return errorResponse(
        requestId, tool, dryRun,
        'FORBIDDEN',
        `API key does not have permission for tool '${tool}'`,
        { 
          requiredScope: permission.requiredScope,
          hint: 'Use an API key with appropriate scopes'
        },
        ERROR_HELP.FORBIDDEN,
        403
      )
    }
    
    // 6. Connect to database
    database = await connect()
    
    // 7. Check idempotency - return cached result if exists
    const cachedResult = await getCachedResult(database, requestId)
    if (cachedResult) {
      log(requestId, 'info', 'Returning cached result (idempotent)')
      cachedResult._meta = {
        ...cachedResult._meta,
        cached: true,
        originalExecutedAt: cachedResult.executedAt
      }
      return NextResponse.json(cachedResult)
    }
    
    // 8. Acquire lock to prevent concurrent execution
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
      // 9. Validate tool is allowlisted
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
      
      // 10. Validate tool arguments
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
      
      // 11. Execute tool
      log(requestId, 'info', `Executing tool: ${tool}`, { dryRun, keyId })
      
      const ctx = {
        db: database,
        dryRun,
        requestId,
        actor,
        startedAt
      }
      
      const result = await executeTool(tool, argsValidation.data, ctx)
      const completedAt = new Date()
      
      // 12. Save audit log
      await saveAuditLog(database, createAuditEntry({
        requestId, 
        tool, 
        args: argsValidation.data, 
        actor, 
        dryRun,
        status: result.ok !== false ? 'succeeded' : 'failed',
        result,
        startedAt,
        completedAt,
        keyId
      }))
      
      // 13. Build and cache response
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
    
    if (database && requestId) {
      try {
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args: {}, actor, dryRun,
          status: 'failed',
          error: { code: 'INTERNAL_ERROR', message: error.message },
          startedAt,
          completedAt: new Date(),
          keyId
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
  
  // Rate limiting for GET requests
  const rateLimit = checkRateLimit(auth.keyId)
  if (!rateLimit.allowed) {
    return NextResponse.json({
      ok: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        help: ERROR_HELP.RATE_LIMIT_EXCEEDED
      }
    }, { 
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000))
      }
    })
  }

  initializeOps()
  
  const tools = getToolNames()
  
  // Build tool info with scopes
  const toolInfo = tools.map(name => ({
    name,
    requiredScope: TOOL_SCOPES[name] || 'ops.execute',
    requiredArgs: name.includes('tenant') || name.includes('billing') || name.includes('voice') 
      ? ['businessId'] 
      : [],
    accessible: checkToolPermission(auth.scopes, name).allowed
  }))
  
  return NextResponse.json({
    ok: true,
    version: VERSION,
    tools: toolInfo,
    keyInfo: {
      id: auth.keyId,
      scopes: auth.scopes
    },
    requestFormats: {
      recommended: {
        format: 'new',
        example: '{ "tool": "tenant.ensure", "payload": { "businessId": "..." }, "meta": { "requestId": "...", "dryRun": false } }'
      },
      legacy: [
        { format: 'args', example: '{ "tool": "...", "requestId": "...", "args": { "businessId": "..." } }' },
        { format: 'input', example: '{ "tool": "...", "requestId": "...", "input": { "businessId": "..." } }' },
        { format: 'flat', example: '{ "tool": "...", "requestId": "...", "businessId": "..." }' }
      ]
    },
    documentation: {
      api: '/docs/ops-control-plane-v1.md',
      n8n: '/docs/n8n-integration-guide.md'
    },
    rateLimit: {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      windowMs: RATE_LIMITS.default.windowMs
    },
    security: {
      scopedKeys: true,
      timingSafeAuth: true,
      rateLimited: true
    },
    health: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })
}
