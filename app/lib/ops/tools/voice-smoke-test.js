/**
 * Tool: voice.smokeTest
 * 
 * Performs lightweight health checks for voice services.
 */

import { z } from 'zod'
import { env } from '@/lib/env'

export const name = 'voice.smokeTest'

export const description = 'Perform health checks for voice services'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required')
})

/**
 * Check an HTTP endpoint
 * @param {string} name - Check name
 * @param {string} url - URL to check
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<object>}
 */
async function checkEndpoint(name, url, timeoutMs = 5000) {
  const startTime = Date.now()
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    
    clearTimeout(timeout)
    const latencyMs = Date.now() - startTime
    
    return {
      name,
      ok: response.ok,
      status: response.status,
      latencyMs,
      details: response.ok ? null : `HTTP ${response.status}`
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    return {
      name,
      ok: false,
      status: null,
      latencyMs,
      details: error.name === 'AbortError' ? 'Timeout' : error.message
    }
  }
}

/**
 * Execute voice.smokeTest
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] voice.smokeTest: Running checks for business ${businessId}`)
  
  const checks = []
  
  // Check 1: Core API health
  const baseUrl = env.BASE_URL || 'http://localhost:3000'
  const coreApiCheck = await checkEndpoint(
    'core_api_health',
    `${baseUrl}/api/health`,
    5000
  )
  checks.push(coreApiCheck)
  
  // Check 2: Agent availability endpoint
  const agentAvailCheck = await checkEndpoint(
    'agent_availability_endpoint',
    `${baseUrl}/api/agent/availability`,
    5000
  )
  // Note: This will return 401 without auth, which is expected
  // We just want to verify the endpoint is reachable
  checks.push({
    ...agentAvailCheck,
    ok: agentAvailCheck.status === 401 || agentAvailCheck.status === 200,
    details: agentAvailCheck.status === 401 
      ? 'Endpoint reachable (auth required)' 
      : agentAvailCheck.details
  })
  
  // Check 3: Agent booking endpoint
  const agentBookCheck = await checkEndpoint(
    'agent_book_endpoint',
    `${baseUrl}/api/agent/book`,
    5000
  )
  checks.push({
    ...agentBookCheck,
    ok: agentBookCheck.status === 401 || agentBookCheck.status === 405 || agentBookCheck.status === 200,
    details: agentBookCheck.status === 401 || agentBookCheck.status === 405
      ? 'Endpoint reachable (auth/method required)' 
      : agentBookCheck.details
  })
  
  // Check 4: Billing endpoint (for metered usage)
  const billingCheck = await checkEndpoint(
    'billing_usage_endpoint',
    `${baseUrl}/api/billing/usage/run-daily`,
    5000
  )
  checks.push({
    ...billingCheck,
    ok: billingCheck.status === 401 || billingCheck.status === 405 || billingCheck.status === 200,
    details: billingCheck.status === 401 || billingCheck.status === 405
      ? 'Endpoint reachable (auth required)' 
      : billingCheck.details
  })
  
  // Calculate overall health
  const passedChecks = checks.filter(c => c.ok).length
  const totalChecks = checks.length
  const allPassed = passedChecks === totalChecks
  
  console.log(`[ops:${requestId}] voice.smokeTest: ${passedChecks}/${totalChecks} checks passed`)
  
  return {
    ok: allPassed,
    businessId,
    checks,
    passed: passedChecks,
    total: totalChecks,
    summary: `${passedChecks}/${totalChecks} checks passed`
  }
}
