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
import {
  saveOpsEventLog,
  createOpsEventLog,
  createFailedEvent
} from '@/lib/schemas/opsEventLog'
import {
  getToolFromRegistry,
  isToolInRegistry,
  getRegisteredToolNames,
  validateToolInput,
  validateToolOutput,
  getCanonicalTools
} from '@/lib/ops/tool-registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops]'
const VERSION = 'v1.3.0'

// ============================================================================
// Event Logging (Fire-and-Forget)
// ============================================================================

/**
 * Emit an ops event log asynchronously (fire-and-forget)
 * Failures are logged but don't affect the main execution flow
 * 
 * @param {Object} db - MongoDB database instance
 * @param {Object} eventData - Event data to log
 */
function emitOpsEvent(db, eventData) {
  // Fire-and-forget: don't await, just catch errors
  saveOpsEventLog(db, eventData)
    .then(() => {
      log(eventData.requestId, 'debug', 'Event logged to ops_event_logs')
    })
    .catch((err) => {
      log(eventData.requestId, 'warn', `Failed to emit ops event: ${err.message}`)
    })
}

/**
 * Determine actor type from key identifier
 * @param {string} keyId - Hashed key identifier
 * @returns {'n8n' | 'human' | 'system' | 'api'}
 */
function determineActor(keyId) {
  // n8n keys typically configured via OPS_KEY_N8N
  if (keyId?.includes('n8n')) return 'n8n'
  // Admin keys are typically human operators
  if (keyId?.includes('admin')) return 'human'
  // Default to system for automated processes
  return 'system'
}

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

// ============================================================================
// Plan Mode - Execution Plan Metadata
// ============================================================================

/**
 * Tool execution plan metadata
 * Defines what each tool will do without actually executing
 */
const TOOL_PLANS = {
  'tenant.bootstrap': {
    description: 'Complete tenant onboarding orchestration',
    steps: [
      { 
        order: 1, 
        name: 'tenant.ensure', 
        description: 'Create or verify tenant record exists',
        mutates: true,
        reversible: true,
        estimatedMs: 50
      },
      { 
        order: 2, 
        name: 'billing.validateStripeConfig', 
        description: 'Validate Stripe configuration',
        mutates: false,
        reversible: true,
        estimatedMs: 200,
        skippable: true
      },
      { 
        order: 3, 
        name: 'voice.smokeTest', 
        description: 'Test voice service endpoints',
        mutates: false,
        reversible: true,
        estimatedMs: 200,
        skippable: true
      },
      { 
        order: 4, 
        name: 'tenant.provisioningSummary', 
        description: 'Get provisioning state summary',
        mutates: false,
        reversible: true,
        estimatedMs: 20
      }
    ],
    sideEffects: [
      { type: 'database', operation: 'upsert', collection: 'businesses', description: 'Creates or updates business record' },
      { type: 'database', operation: 'insert', collection: 'ops_audit_logs', description: 'Logs execution audit trail' },
      { type: 'database', operation: 'insert', collection: 'ops_event_logs', description: 'Logs execution event' }
    ],
    requiredSecrets: [
      { name: 'MONGO_URL', description: 'Database connection', required: true },
      { name: 'STRIPE_SECRET_KEY', description: 'Stripe API access', required: false, skippableWith: 'skipBillingCheck' },
      { name: 'CORE_API_URL', description: 'Voice service endpoint', required: false, skippableWith: 'skipVoiceTest' }
    ],
    estimatedRisk: 'medium',
    estimatedDurationMs: 400,
    idempotent: true,
    dryRunSupported: true
  },
  'tenant.ensure': {
    description: 'Create or verify tenant record',
    steps: [
      { order: 1, name: 'checkExists', description: 'Check if business exists in database', mutates: false, estimatedMs: 10 },
      { order: 2, name: 'createOrUpdate', description: 'Create business if not exists', mutates: true, estimatedMs: 30 }
    ],
    sideEffects: [
      { type: 'database', operation: 'upsert', collection: 'businesses', description: 'Creates or updates business record' }
    ],
    requiredSecrets: [
      { name: 'MONGO_URL', description: 'Database connection', required: true }
    ],
    estimatedRisk: 'low',
    estimatedDurationMs: 50,
    idempotent: true,
    dryRunSupported: true
  },
  'billing.validateStripeConfig': {
    description: 'Validate Stripe environment configuration',
    steps: [
      { order: 1, name: 'checkKeys', description: 'Verify Stripe API keys are configured', mutates: false, estimatedMs: 5 },
      { order: 2, name: 'checkMode', description: 'Determine test vs live mode', mutates: false, estimatedMs: 5 },
      { order: 3, name: 'validatePrices', description: 'Verify price IDs exist in Stripe', mutates: false, estimatedMs: 150 }
    ],
    sideEffects: [],
    requiredSecrets: [
      { name: 'STRIPE_SECRET_KEY', description: 'Stripe API access', required: true },
      { name: 'STRIPE_PRICE_MONTHLY', description: 'Monthly price ID', required: false },
      { name: 'STRIPE_PRICE_YEARLY', description: 'Yearly price ID', required: false }
    ],
    estimatedRisk: 'low',
    estimatedDurationMs: 200,
    idempotent: true,
    dryRunSupported: false
  },
  'voice.smokeTest': {
    description: 'Health check voice/AI calling services',
    steps: [
      { order: 1, name: 'checkCoreApi', description: 'Test core API health endpoint', mutates: false, estimatedMs: 50 },
      { order: 2, name: 'checkAgentAvailability', description: 'Test agent availability endpoint', mutates: false, estimatedMs: 50 },
      { order: 3, name: 'checkAgentBook', description: 'Test agent booking endpoint', mutates: false, estimatedMs: 50 },
      { order: 4, name: 'checkBillingUsage', description: 'Test billing usage endpoint', mutates: false, estimatedMs: 50 }
    ],
    sideEffects: [],
    requiredSecrets: [
      { name: 'CORE_API_URL', description: 'Core API base URL', required: true },
      { name: 'CORE_API_INTERNAL_SECRET', description: 'Internal API auth', required: true }
    ],
    estimatedRisk: 'low',
    estimatedDurationMs: 200,
    idempotent: true,
    dryRunSupported: false
  },
  'tenant.provisioningSummary': {
    description: 'Get complete tenant provisioning state',
    steps: [
      { order: 1, name: 'fetchBusiness', description: 'Load business record', mutates: false, estimatedMs: 10 },
      { order: 2, name: 'checkSubscription', description: 'Check subscription status', mutates: false, estimatedMs: 5 },
      { order: 3, name: 'checkCalendar', description: 'Check calendar connection', mutates: false, estimatedMs: 5 },
      { order: 4, name: 'checkScheduling', description: 'Check scheduling configuration', mutates: false, estimatedMs: 5 },
      { order: 5, name: 'calculateScore', description: 'Calculate provisioning score', mutates: false, estimatedMs: 5 }
    ],
    sideEffects: [],
    requiredSecrets: [
      { name: 'MONGO_URL', description: 'Database connection', required: true }
    ],
    estimatedRisk: 'low',
    estimatedDurationMs: 30,
    idempotent: true,
    dryRunSupported: false
  }
}

/**
 * Generate execution plan for a tool without executing
 * @param {string} tool - Tool name
 * @param {object} args - Tool arguments
 * @param {object} ctx - Context (dryRun, requestId, etc.)
 * @returns {object} Execution plan
 */
function generateExecutionPlan(tool, args, ctx) {
  const plan = TOOL_PLANS[tool]
  
  if (!plan) {
    return {
      ok: false,
      error: {
        code: 'NO_PLAN_AVAILABLE',
        message: `No execution plan available for tool '${tool}'`
      }
    }
  }
  
  // Build deterministic execution plan
  const steps = plan.steps.map(step => {
    // Check if step can be skipped based on args
    let willSkip = false
    let skipReason = null
    
    if (step.skippable) {
      if (step.name === 'billing.validateStripeConfig' && args.skipBillingCheck) {
        willSkip = true
        skipReason = 'skipBillingCheck=true'
      }
      if (step.name === 'voice.smokeTest' && args.skipVoiceTest) {
        willSkip = true
        skipReason = 'skipVoiceTest=true'
      }
    }
    
    return {
      ...step,
      willExecute: !willSkip,
      skipReason
    }
  })
  
  // Filter side effects based on what will actually run
  const sideEffects = plan.sideEffects.filter(effect => {
    // All database operations for audit/event logs always happen
    if (effect.collection === 'ops_audit_logs' || effect.collection === 'ops_event_logs') {
      return true
    }
    return true // Include all by default
  })
  
  // Check which secrets are actually required based on args
  const requiredSecrets = plan.requiredSecrets.map(secret => {
    let actuallyRequired = secret.required
    
    // Check if secret can be skipped
    if (secret.skippableWith) {
      if (secret.skippableWith === 'skipBillingCheck' && args.skipBillingCheck) {
        actuallyRequired = false
      }
      if (secret.skippableWith === 'skipVoiceTest' && args.skipVoiceTest) {
        actuallyRequired = false
      }
    }
    
    // Check if secret is configured (without revealing value)
    const isConfigured = checkSecretConfigured(secret.name)
    
    return {
      ...secret,
      actuallyRequired,
      isConfigured,
      status: !actuallyRequired ? 'skipped' : (isConfigured ? 'ready' : 'missing')
    }
  })
  
  // Calculate estimated duration
  const estimatedDurationMs = steps
    .filter(s => s.willExecute)
    .reduce((sum, s) => sum + (s.estimatedMs || 0), 0)
  
  // Determine if plan can execute
  const missingSecrets = requiredSecrets.filter(s => s.status === 'missing')
  const canExecute = missingSecrets.length === 0
  
  return {
    ok: true,
    mode: 'plan',
    tool,
    description: plan.description,
    args: {
      provided: args,
      validated: true
    },
    plan: {
      steps,
      stepCount: steps.length,
      stepsToExecute: steps.filter(s => s.willExecute).length,
      stepsToSkip: steps.filter(s => !s.willExecute).length
    },
    sideEffects,
    requiredSecrets,
    risk: {
      level: plan.estimatedRisk,
      mutates: steps.some(s => s.willExecute && s.mutates),
      reversible: steps.every(s => !s.willExecute || s.reversible !== false)
    },
    timing: {
      estimatedDurationMs,
      idempotent: plan.idempotent,
      dryRunSupported: plan.dryRunSupported
    },
    readiness: {
      canExecute,
      missingSecrets: missingSecrets.map(s => s.name),
      warnings: missingSecrets.length > 0 
        ? [`Missing required secrets: ${missingSecrets.map(s => s.name).join(', ')}`]
        : []
    },
    nextStep: canExecute 
      ? 'Call with mode="execute" to run this plan'
      : `Configure missing secrets first: ${missingSecrets.map(s => s.name).join(', ')}`
  }
}

/**
 * Check if a secret/env var is configured (without revealing value)
 */
function checkSecretConfigured(name) {
  switch (name) {
    case 'MONGO_URL':
      return !!env.MONGO_URL
    case 'STRIPE_SECRET_KEY':
      return !!env.STRIPE_SECRET_KEY
    case 'STRIPE_PRICE_MONTHLY':
      return !!env.STRIPE_PRICE_MONTHLY
    case 'STRIPE_PRICE_YEARLY':
      return !!env.STRIPE_PRICE_YEARLY
    case 'CORE_API_URL':
      return !!env.CORE_API_URL
    case 'CORE_API_INTERNAL_SECRET':
      return !!env.CORE_API_INTERNAL_SECRET
    default:
      // For unknown secrets, check if they exist in env object
      return env[name] !== undefined
  }
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
  mode: z.enum(['plan', 'execute']).optional().default('execute'),
  approved: z.boolean().optional().default(false), // Pre-approval flag for high-risk tools
  approvalToken: z.string().optional(), // Optional approval token for audit trail
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
  mode: z.enum(['plan', 'execute']).optional().default('execute'),
  approved: z.boolean().optional().default(false), // Pre-approval flag
  approvalToken: z.string().optional(), // Optional approval token
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
 * @returns { tool, args, requestId, dryRun, mode, approved, approvalToken, actor, format }
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
        mode: result.data.meta.mode || 'execute',
        approved: result.data.meta.approved || false,
        approvalToken: result.data.meta.approvalToken || null,
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
    // Legacy format also supports mode and approved via body
    return {
      valid: true,
      tool: data.tool,
      args,
      requestId: data.requestId,
      dryRun: data.dryRun,
      mode: body.mode || 'execute',
      approved: body.approved || false,
      approvalToken: body.approvalToken || null,
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
    const mode = parseResult.mode || 'execute'
    const approved = parseResult.approved || false
    const approvalToken = parseResult.approvalToken || null
    actor = parseResult.actor
    const args = parseResult.args
    argsSource = parseResult.format
    
    logRequest(requestId, tool, dryRun, args, argsSource, keyId)
    log(requestId, 'info', `Mode: ${mode}`, { dryRun, approved })
    
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
    
    // 5a. APPROVAL GATE - Check if tool requires approval
    // This runs before plan mode to ensure approval status is checked early
    const toolFromRegistryForApproval = getToolFromRegistry(tool)
    if (toolFromRegistryForApproval) {
      const requiresApproval = toolFromRegistryForApproval.risk === 'high' || 
                               toolFromRegistryForApproval.requiresApproval === true
      
      if (requiresApproval && !approved) {
        log(requestId, 'info', `Tool requires approval: ${tool}`, {
          risk: toolFromRegistryForApproval.risk,
          requiresApproval: toolFromRegistryForApproval.requiresApproval
        })
        
        // Create pending approval event log
        try {
          const database = await connect()
          const pendingEventLog = createOpsEventLog({
            requestId,
            tool,
            businessId: args?.businessId || null,
            status: 'pending',
            durationMs: 0,
            executedAt: new Date(),
            actor: determineActor(keyId),
            metadata: {
              pendingApproval: true,
              approvalReason: toolFromRegistryForApproval.risk === 'high' ? 'risk=high' : 'requiresApproval=true',
              payload: args,
              dryRun,
              keyId,
              argsFormat: argsSource
            }
          })
          emitOpsEvent(database, pendingEventLog)
        } catch (eventError) {
          log(requestId, 'warn', `Failed to log pending approval event: ${eventError.message}`)
        }
        
        return NextResponse.json({
          ok: false,
          status: 'approval_required',
          requestId,
          tool,
          dryRun,
          approval: {
            type: 'human',
            reason: toolFromRegistryForApproval.risk === 'high' ? 'risk=high' : 'requiresApproval=true',
            tool: tool,
            toolDescription: toolFromRegistryForApproval.description,
            risk: toolFromRegistryForApproval.risk,
            payload: args,
            howToApprove: 'Re-submit the request with meta.approved=true after human review',
            approvalEndpoint: '/api/internal/ops/execute',
            approvalPayloadExample: {
              tool,
              payload: args,
              meta: {
                requestId: `${requestId}-approved`,
                approved: true,
                approvalToken: '<optional-audit-token>'
              }
            }
          },
          _meta: {
            version: VERSION,
            timestamp: new Date().toISOString()
          }
        }, { status: 403 })
      }
      
      // If approved flag is set, log that execution was pre-approved
      if (requiresApproval && approved) {
        log(requestId, 'info', `Execution pre-approved for high-risk tool: ${tool}`, {
          approvalToken,
          risk: toolFromRegistryForApproval.risk
        })
      }
    }
    
    // 5b. PLAN MODE - Return execution plan without executing
    if (mode === 'plan') {
      log(requestId, 'info', `Generating execution plan for tool: ${tool}`)
      
      // Validate tool is allowlisted first
      if (!isToolAllowed(tool)) {
        const availableTools = getToolNames()
        return errorResponse(
          requestId, tool, dryRun,
          'TOOL_NOT_ALLOWED',
          `Tool '${tool}' is not in the allowlist`,
          { availableTools, requestedTool: tool },
          ERROR_HELP.TOOL_NOT_ALLOWED
        )
      }
      
      // Validate args for plan mode too
      const argsValidation = validateToolArgs(tool, args)
      if (!argsValidation.valid) {
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
      
      // Generate execution plan
      const plan = generateExecutionPlan(tool, argsValidation.data, { dryRun, requestId })
      
      const durationMs = Date.now() - startedAt.getTime()
      
      return NextResponse.json({
        ok: plan.ok,
        requestId,
        tool,
        mode: 'plan',
        dryRun,
        result: plan,
        error: plan.error || null,
        generatedAt: new Date().toISOString(),
        durationMs,
        _meta: {
          version: VERSION,
          timestamp: new Date().toISOString()
        }
      })
    }
    
    // 6. Connect to database (only for execute mode)
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
      // 9. REGISTRY-DRIVEN VALIDATION: Tool must exist in registry
      // Rule: "If it's not in /ops/tools, it can't be executed"
      const toolFromRegistry = getToolFromRegistry(tool)
      
      if (!toolFromRegistry) {
        const availableTools = getRegisteredToolNames(false) // Only canonical tools
        const allTools = getRegisteredToolNames(true) // Including deprecated
        
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { 
            code: 'TOOL_NOT_IN_REGISTRY', 
            message: `Tool '${tool}' not found in registry. Only registered tools can be executed.`
          },
          startedAt,
          completedAt: new Date()
        }))
        
        return errorResponse(
          requestId, tool, dryRun,
          'TOOL_NOT_IN_REGISTRY',
          `Tool '${tool}' not found in registry`,
          { 
            requestedTool: tool,
            availableTools: availableTools,
            allRegisteredTools: allTools,
            hint: 'Only tools defined in GET /api/internal/ops/tools can be executed',
            registryEndpoint: '/api/internal/ops/tools'
          },
          'Check GET /api/internal/ops/tools for available tools. Rule: "If it\'s not in the registry, it can\'t be executed."'
        )
      }
      
      // 9b. Check if tool is deprecated and log warning
      if (toolFromRegistry.deprecated) {
        log(requestId, 'warn', `Using deprecated tool: ${tool}`, {
          reason: toolFromRegistry.deprecatedReason,
          replacedBy: toolFromRegistry.replacedBy
        })
      }
      
      // 9c. Also validate against legacy allowlist (belt and suspenders)
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
      
      // 10. REGISTRY-DRIVEN INPUT VALIDATION
      // Validate against registry's inputSchema first
      const registryValidation = validateToolInput(tool, args)
      if (!registryValidation.valid) {
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args, actor, dryRun,
          status: 'failed',
          error: { 
            code: 'REGISTRY_VALIDATION_ERROR', 
            message: 'Input validation failed against registry schema',
            schemaErrors: registryValidation.errors
          },
          startedAt,
          completedAt: new Date()
        }))
        
        return errorResponse(
          requestId, tool, dryRun,
          'REGISTRY_VALIDATION_ERROR',
          'Input validation failed against tool registry schema',
          {
            errors: registryValidation.errors,
            receivedArgs: Object.keys(args),
            argsFormat: argsSource,
            inputSchema: toolFromRegistry.inputSchema,
            hint: 'Check GET /api/internal/ops/tools for the tool\'s inputSchema'
          },
          'Validate input against the tool\'s inputSchema from GET /api/internal/ops/tools'
        )
      }
      
      // 10b. Also run legacy Zod validation (for additional constraints)
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
      log(requestId, 'info', `Executing tool: ${tool}`, { 
        dryRun, 
        keyId,
        toolMetadata: {
          category: toolFromRegistry.category,
          mutates: toolFromRegistry.mutates,
          risk: toolFromRegistry.risk,
          deprecated: toolFromRegistry.deprecated
        }
      })
      
      const ctx = {
        db: database,
        dryRun,
        requestId,
        actor,
        startedAt,
        toolMetadata: toolFromRegistry // Pass registry metadata to tool
      }
      
      const result = await executeTool(tool, argsValidation.data, ctx)
      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt.getTime()
      
      // 11b. REGISTRY-DRIVEN OUTPUT VALIDATION (warning only, doesn't block)
      const outputValidation = validateToolOutput(tool, result)
      if (!outputValidation.valid) {
        log(requestId, 'warn', 'Output schema validation warnings', {
          tool,
          warnings: outputValidation.warnings
        })
      }
      
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
        keyId,
        toolMetadata: {
          category: toolFromRegistry.category,
          deprecated: toolFromRegistry.deprecated,
          outputSchemaValid: outputValidation.valid
        }
      }))
      
      // 12b. Emit ops event log (fire-and-forget)
      try {
        // Determine status: success, failed, or partial (for bootstrap with ready=false)
        let eventStatus = 'success'
        if (result.ok === false) {
          eventStatus = 'failed'
        } else if (tool === 'tenant.bootstrap' && result.ready === false) {
          eventStatus = 'partial'
        }
        
        // Extract businessId from args if present
        const businessId = argsValidation.data?.businessId || result?.businessId || null
        
        // Build event log entry
        const eventLog = createOpsEventLog({
          requestId,
          tool,
          businessId,
          status: eventStatus,
          durationMs,
          executedAt: completedAt,
          actor: determineActor(keyId),
          metadata: {
            dryRun,
            ready: result.ready,
            readyMessage: result.readyMessage,
            checklist: result.checklist,
            recommendations: result.recommendations,
            stats: result.stats,
            error: result.error,
            keyId,
            argsFormat: argsSource,
            summary: result.summary
          }
        })
        
        // Fire-and-forget: emit event without blocking response
        emitOpsEvent(database, eventLog)
      } catch (eventError) {
        // Never let event logging break the main flow
        log(requestId, 'warn', `Event logging setup failed: ${eventError.message}`)
      }
      
      // 13. Build and cache response
      const response = {
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
    
    const completedAt = new Date()
    const durationMs = startedAt ? completedAt.getTime() - startedAt.getTime() : 0
    
    if (database && requestId) {
      try {
        await saveAuditLog(database, createAuditEntry({
          requestId, tool, args: {}, actor, dryRun,
          status: 'failed',
          error: { code: 'INTERNAL_ERROR', message: error.message },
          startedAt,
          completedAt,
          keyId
        }))
      } catch (auditError) {
        log(requestId, 'error', `Failed to save audit log: ${auditError.message}`)
      }
      
      // Emit failed event log (fire-and-forget)
      try {
        const failedEventLog = createFailedEvent(
          requestId,
          tool || 'unknown',
          { code: 'INTERNAL_ERROR', message: error.message, type: error.constructor?.name },
          {
            businessId: null,
            durationMs,
            actor: keyId ? determineActor(keyId) : 'system',
            keyId,
            argsFormat: argsSource
          }
        )
        emitOpsEvent(database, failedEventLog)
      } catch (eventError) {
        log(requestId, 'warn', `Failed event logging setup failed: ${eventError.message}`)
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
  
  // No rate limiting for authenticated GET requests - this is just a health check / tool listing endpoint
  // Rate limiting is only applied to POST requests that actually execute tools

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
    security: {
      scopedKeys: true,
      timingSafeAuth: true,
      rateLimited: 'POST only'
    },
    health: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })
}
