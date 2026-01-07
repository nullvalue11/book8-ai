/**
 * Tool: voice.diagnostics
 * 
 * Read-only voice service diagnostics - checks latency and connectivity to voice targets.
 * Uses fetch with AbortController timeout. Returns structured results without throwing.
 * 
 * Category: voice
 * Risk: low
 * Mutates: false
 * Requires Approval: false
 */

import { z } from 'zod'
import { env } from '@/lib/env'

export const name = 'voice.diagnostics'

export const description = 'Voice service diagnostics - checks latency and connectivity to voice targets'

// Default voice service targets to check
const DEFAULT_TARGETS = [
  { name: 'vapi_api', url: 'https://api.vapi.ai/health', type: 'health' },
  { name: 'openai_api', url: 'https://api.openai.com/v1/models', type: 'auth', requiresKey: 'OPENAI_API_KEY' },
  { name: 'elevenlabs_api', url: 'https://api.elevenlabs.io/v1/user', type: 'auth', requiresKey: 'ELEVENLABS_API_KEY' }
]

export const schema = z.object({
  businessId: z.string().optional().describe('Optional business context for logging'),
  targets: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    type: z.enum(['health', 'auth', 'ping']).default('health'),
    requiresKey: z.string().optional()
  })).optional().describe('Custom targets to check (defaults to voice service endpoints)'),
  timeoutMs: z.number().min(100).max(30000).default(5000).describe('Timeout per target in milliseconds')
})

/**
 * Check a single target with timeout
 * @param {object} target - Target configuration
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<object>} Check result
 */
async function checkTarget(target, timeoutMs) {
  const { name, url, type, requiresKey } = target
  const startTime = Date.now()
  
  // Check if required API key is available
  if (requiresKey && !env[requiresKey]) {
    return {
      target: name,
      url,
      status: 'skipped',
      reason: `Missing environment variable: ${requiresKey}`,
      latencyMs: 0
    }
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const headers = { 'Content-Type': 'application/json' }
    
    // Add auth headers if needed
    if (type === 'auth' && requiresKey) {
      const apiKey = env[requiresKey]
      if (requiresKey === 'OPENAI_API_KEY') {
        headers['Authorization'] = `Bearer ${apiKey}`
      } else if (requiresKey === 'ELEVENLABS_API_KEY') {
        headers['xi-api-key'] = apiKey
      }
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime
    
    // Determine status based on response
    let status = 'unknown'
    let reason = `HTTP ${response.status}`
    
    if (response.ok) {
      status = 'healthy'
      reason = 'OK'
    } else if (response.status === 401 || response.status === 403) {
      status = 'auth_error'
      reason = 'Authentication failed - check API key'
    } else if (response.status >= 500) {
      status = 'unhealthy'
      reason = `Server error: ${response.status}`
    } else {
      status = 'degraded'
      reason = `Unexpected status: ${response.status}`
    }
    
    return {
      target: name,
      url,
      status,
      reason,
      latencyMs,
      httpStatus: response.status
    }
    
  } catch (error) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime
    
    let status = 'error'
    let reason = error.message
    
    if (error.name === 'AbortError') {
      status = 'timeout'
      reason = `Request timed out after ${timeoutMs}ms`
    } else if (error.code === 'ECONNREFUSED') {
      status = 'unreachable'
      reason = 'Connection refused'
    } else if (error.code === 'ENOTFOUND') {
      status = 'dns_error'
      reason = 'DNS lookup failed'
    }
    
    return {
      target: name,
      url,
      status,
      reason,
      latencyMs,
      error: error.message
    }
  }
}

/**
 * Execute voice.diagnostics
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId, targets: customTargets, timeoutMs = 5000 } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] voice.diagnostics: Starting diagnostics${businessId ? ` for ${businessId}` : ''}`)
  
  // Use custom targets or defaults
  const targets = customTargets && customTargets.length > 0 ? customTargets : DEFAULT_TARGETS
  
  // Run all checks in parallel
  const startTime = Date.now()
  const results = await Promise.all(
    targets.map(target => checkTarget(target, timeoutMs))
  )
  const totalDurationMs = Date.now() - startTime
  
  // Calculate statistics
  const healthy = results.filter(r => r.status === 'healthy').length
  const unhealthy = results.filter(r => ['unhealthy', 'error', 'timeout', 'unreachable', 'dns_error'].includes(r.status)).length
  const skipped = results.filter(r => r.status === 'skipped').length
  const total = results.length
  
  // Calculate average latency (excluding skipped and errored)
  const validLatencies = results.filter(r => r.status === 'healthy' && r.latencyMs > 0).map(r => r.latencyMs)
  const avgLatencyMs = validLatencies.length > 0 
    ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
    : null
  
  // Determine overall status
  let overallStatus = 'healthy'
  let statusReason = 'All services operational'
  
  if (unhealthy > 0) {
    overallStatus = unhealthy === total ? 'critical' : 'degraded'
    statusReason = `${unhealthy}/${total} service(s) unhealthy`
  } else if (skipped === total) {
    overallStatus = 'unknown'
    statusReason = 'All checks skipped (missing API keys)'
  }
  
  console.log(`[ops:${requestId}] voice.diagnostics: ${overallStatus} - ${healthy}/${total} healthy`)
  
  return {
    ok: true,
    businessId: businessId || null,
    overallStatus,
    statusReason,
    summary: {
      total,
      healthy,
      unhealthy,
      skipped,
      avgLatencyMs,
      totalDurationMs
    },
    results,
    checkedAt: new Date().toISOString()
  }
}
