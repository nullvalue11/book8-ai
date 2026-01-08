/**
 * GET /api/internal/ops/tools
 * 
 * Ops Tool Registry - Enables AI agents to discover and reason about available ops tools.
 * 
 * Returns an array of tool definitions with metadata including:
 * - name, description, category
 * - mutates, risk level, dryRunSupported
 * - allowedCallers, requiresApproval
 * - inputSchema (JSON Schema for inputs)
 * 
 * Query Parameters:
 * - category (optional): Filter by category (tenant, billing, voice, system)
 * - includeDeprecated (optional): Include deprecated tools (default: false)
 * - format (optional): "full" | "minimal" (default: "full")
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 * Required scope: ops.tools.read or ops.* or *
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { env } from '@/lib/env'
import {
  TOOL_REGISTRY,
  CATEGORIES,
  RISK_LEVELS
} from '@/lib/ops/tool-registry'
import { checkRateLimit } from '@/api/internal/ops/_lib/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/tools]'
const VERSION = 'v1.0.0'

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

function getApiKeyScopes() {
  const keys = {}
  
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'ops.logs.read', 'ops.tools.read', 'tenant.*', 'voice.*', 'billing.read']
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

function getRateLimitIdentifier(apiKey) {
  if (!apiKey) return 'unknown'
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  return `key_${hash.substring(0, 8)}`
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
  
  // Check for tools read permission
  const requiredScope = 'ops.tools.read'
  if (!hasScope(matchedScopes, requiredScope)) {
    return {
      valid: false,
      error: `API key does not have permission to read tool registry`,
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

export async function GET(request) {
  const startTime = Date.now()
  
  try {
    // 0. RATE LIMITING FIRST (before auth to protect against brute force)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown-ip'
    const authHeader = request.headers.get('x-book8-internal-secret') || ''
    const preAuthIdentifier = `ip_${crypto.createHash('sha256').update(clientIp + authHeader).digest('hex').substring(0, 8)}`
    
    console.log(`[RATE_LIMITER] /tools - Checking rate limit for: ${preAuthIdentifier}`)
    const rateLimit = await checkRateLimit(preAuthIdentifier, 'default', 'tools')
    console.log(`[RATE_LIMITER] /tools - Result: allowed=${rateLimit.allowed}, remaining=${rateLimit.remaining}`)
    
    if (!rateLimit.allowed) {
      log('warn', `Rate limit exceeded for: ${preAuthIdentifier}`)
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
    }
    
    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const includeDeprecated = searchParams.get('includeDeprecated') === 'true'
    const format = searchParams.get('format') || 'full'
    const callerType = searchParams.get('caller') // Filter by allowed caller
    
    // 3. Validate category if provided
    if (category && !CATEGORIES[category]) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INVALID_PARAMS',
          message: `Invalid category '${category}'`,
          validCategories: Object.keys(CATEGORIES)
        },
        _meta: { version: VERSION }
      }, { status: 400 })
    }
    
    // 4. Filter tools
    let tools = [...TOOL_REGISTRY]
    
    // Filter by category
    if (category) {
      tools = tools.filter(t => t.category === category)
    }
    
    // Filter deprecated
    if (!includeDeprecated) {
      tools = tools.filter(t => !t.deprecated)
    }
    
    // Filter by caller type
    if (callerType) {
      tools = tools.filter(t => t.allowedCallers.includes(callerType))
    }
    
    // 5. Format output
    let formattedTools
    if (format === 'minimal') {
      formattedTools = tools.map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        deprecated: t.deprecated,
        risk: t.risk,
        mutates: t.mutates
      }))
    } else {
      formattedTools = tools
    }
    
    // 6. Build response
    const durationMs = Date.now() - startTime
    
    log('info', `Returned ${formattedTools.length} tools`, { 
      category, 
      includeDeprecated, 
      format,
      keyId: auth.keyId 
    })
    
    return NextResponse.json({
      ok: true,
      tools: formattedTools,
      categories: CATEGORIES,
      riskLevels: RISK_LEVELS,
      summary: {
        total: formattedTools.length,
        byCategory: Object.keys(CATEGORIES).reduce((acc, cat) => {
          acc[cat] = formattedTools.filter(t => t.category === cat).length
          return acc
        }, {}),
        deprecated: tools.filter(t => t.deprecated).length,
        canonical: tools.filter(t => t.canonicalFor).length
      },
      guidance: {
        forTenantOnboarding: 'Use tenant.bootstrap - it is the ONLY supported path',
        deprecatedToolsNote: 'Deprecated tools exist only for internal use and debugging',
        dryRunRecommendation: 'Always test with dryRun: true first for mutating operations'
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
