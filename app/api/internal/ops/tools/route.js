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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/tools]'
const VERSION = 'v1.0.0'

// ============================================================================
// Tool Registry - The Source of Truth
// ============================================================================

const TOOL_REGISTRY = [
  // =========================================================================
  // CANONICAL TOOLS (Use these)
  // =========================================================================
  {
    name: 'tenant.bootstrap',
    description: 'Complete tenant onboarding - THE canonical path for creating and validating tenants. Orchestrates tenant creation, billing validation, voice testing, and provisioning summary in a single atomic operation.',
    category: 'tenant',
    mutates: true,
    risk: 'medium',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api', 'mcp'],
    requiresApproval: false,
    deprecated: false,
    canonicalFor: 'tenant-onboarding',
    replaces: ['tenant.ensure', 'billing.validateStripeConfig', 'voice.smokeTest', 'tenant.provisioningSummary'],
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { 
          type: 'string', 
          description: 'Unique business identifier',
          minLength: 1
        },
        name: { 
          type: 'string', 
          description: 'Business display name (used if creating new tenant)'
        },
        skipVoiceTest: { 
          type: 'boolean', 
          default: false,
          description: 'Skip voice smoke test for faster execution'
        },
        skipBillingCheck: { 
          type: 'boolean', 
          default: false,
          description: 'Skip Stripe validation'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        ready: { type: 'boolean', description: 'Is tenant fully operational?' },
        readyMessage: { type: 'string', description: 'Human-readable status' },
        checklist: { 
          type: 'array', 
          description: 'Step-by-step execution results',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              item: { type: 'string' },
              status: { type: 'string', enum: ['done', 'warning', 'in_progress', 'skipped', 'failed'] },
              details: { type: 'string' }
            }
          }
        },
        recommendations: { type: 'array', description: 'Suggested next actions' },
        stats: { 
          type: 'object',
          properties: {
            totalSteps: { type: 'number' },
            completed: { type: 'number' },
            warnings: { type: 'number' },
            skipped: { type: 'number' },
            failed: { type: 'number' }
          }
        }
      }
    },
    examples: [
      {
        name: 'Basic bootstrap',
        input: { businessId: 'biz_abc123' },
        description: 'Run full bootstrap with all checks'
      },
      {
        name: 'Fast bootstrap',
        input: { businessId: 'biz_abc123', skipVoiceTest: true, skipBillingCheck: true },
        description: 'Quick bootstrap skipping optional checks (~15ms vs ~400ms)'
      }
    ],
    documentation: '/docs/tenant-bootstrap-canonical.md'
  },

  // =========================================================================
  // DEPRECATED TOOLS (Do not use directly)
  // =========================================================================
  {
    name: 'tenant.ensure',
    description: '⚠️ DEPRECATED: Create or verify a business record exists. Use tenant.bootstrap instead.',
    category: 'tenant',
    mutates: true,
    risk: 'low',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Unique business identifier' },
        name: { type: 'string', description: 'Business display name' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string' },
        existed: { type: 'boolean' },
        created: { type: 'boolean' }
      }
    }
  },
  {
    name: 'billing.validateStripeConfig',
    description: '⚠️ DEPRECATED: Validate Stripe environment configuration. Use tenant.bootstrap instead.',
    category: 'billing',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier for context' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        stripeConfigured: { type: 'boolean' },
        stripeMode: { type: 'string', enum: ['test', 'live'] },
        checks: { type: 'array' }
      }
    }
  },
  {
    name: 'voice.smokeTest',
    description: '⚠️ DEPRECATED: Health check voice/AI calling services. Use tenant.bootstrap instead.',
    category: 'voice',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier for context' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        passed: { type: 'number' },
        total: { type: 'number' },
        checks: { type: 'array' }
      }
    }
  },
  {
    name: 'tenant.provisioningSummary',
    description: '⚠️ DEPRECATED: Get complete tenant provisioning state. Use tenant.bootstrap instead.',
    category: 'tenant',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        provisioningScore: { type: 'number' },
        subscription: { type: 'object' },
        calendar: { type: 'object' },
        scheduling: { type: 'object' },
        voice: { type: 'object' }
      }
    }
  }
]

// ============================================================================
// Tool Categories
// ============================================================================

const CATEGORIES = {
  tenant: {
    name: 'Tenant Management',
    description: 'Tools for creating, configuring, and managing tenants'
  },
  billing: {
    name: 'Billing & Payments',
    description: 'Tools for Stripe integration and payment validation'
  },
  voice: {
    name: 'Voice & AI Calling',
    description: 'Tools for voice agent testing and configuration'
  },
  system: {
    name: 'System Operations',
    description: 'Tools for system-level operations and diagnostics'
  }
}

// ============================================================================
// Risk Levels
// ============================================================================

const RISK_LEVELS = {
  low: {
    name: 'Low Risk',
    description: 'Read-only or minimal impact operations',
    requiresConfirmation: false
  },
  medium: {
    name: 'Medium Risk',
    description: 'Creates or modifies data, reversible',
    requiresConfirmation: false
  },
  high: {
    name: 'High Risk',
    description: 'Significant changes, may be difficult to reverse',
    requiresConfirmation: true
  }
}

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
