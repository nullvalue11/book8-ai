/**
 * tenant.bootstrap Tool
 * 
 * Orchestrates complete tenant onboarding in a single call.
 * Replaces multiple n8n nodes with one atomic operation.
 * 
 * Steps:
 * 1. Ensure tenant exists (tenant.ensure)
 * 2. Run voice smoke test (voice.smokeTest)
 * 3. Get provisioning summary (tenant.provisioningSummary)
 * 
 * Returns comprehensive readiness status.
 */

import { z } from 'zod'

export const name = 'tenant.bootstrap'

export const description = 'Orchestrate complete tenant onboarding (ensure + voice test + provisioning summary)'

// Schema for tenant.bootstrap arguments
export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  name: z.string().optional(),
  skipVoiceTest: z.boolean().optional().default(false),
})

/**
 * Execute the bootstrap tool
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context { db, dryRun, requestId, actor }
 */
export async function execute(args, ctx) {
  const { db, dryRun, requestId } = ctx
  const { businessId, name, skipVoiceTest } = args
  
  const startTime = Date.now()
  const checklist = []
  const details = {}
  let ready = true
  
  // Import sibling tools
  const tenantEnsure = await import('./tenant-ensure.js')
  const voiceSmokeTest = await import('./voice-smoke-test.js')
  const tenantProvisioningSummary = await import('./tenant-provisioning-summary.js')
  
  try {
    // =========================================================================
    // Step 1: Ensure tenant exists
    // =========================================================================
    const ensureArgs = { businessId }
    if (name) ensureArgs.name = name
    
    const ensureResult = await tenantEnsure.execute(ensureArgs, ctx)
    
    checklist.push({
      step: 1,
      item: 'Tenant Record',
      tool: 'tenant.ensure',
      status: ensureResult.ok !== false ? 'done' : 'failed',
      details: ensureResult.existed ? 'Already exists' : (ensureResult.created ? 'Created' : 'Checked'),
      durationMs: Date.now() - startTime
    })
    
    details.tenant = {
      businessId: ensureResult.businessId,
      existed: ensureResult.existed,
      created: ensureResult.created,
    }
    
    if (ensureResult.ok === false) {
      ready = false
    }
    
    // =========================================================================
    // Step 2: Voice smoke test (optional)
    // =========================================================================
    if (!skipVoiceTest) {
      const voiceStartTime = Date.now()
      const voiceResult = await voiceSmokeTest.execute({ businessId }, ctx)
      
      const voicePassed = voiceResult.ok !== false && voiceResult.passed === voiceResult.total
      
      checklist.push({
        step: 2,
        item: 'Voice Services',
        tool: 'voice.smokeTest',
        status: voicePassed ? 'done' : 'warning',
        details: `${voiceResult.passed || 0}/${voiceResult.total || 0} checks passed`,
        durationMs: Date.now() - voiceStartTime
      })
      
      details.voice = {
        passed: voiceResult.passed,
        total: voiceResult.total,
        checks: voiceResult.checks,
      }
      
      // Voice failures are warnings, not blockers
      if (!voicePassed) {
        // Don't set ready = false, just note it
        details.voice.warning = 'Some voice checks failed - this may affect AI calling features'
      }
    } else {
      checklist.push({
        step: 2,
        item: 'Voice Services',
        tool: 'voice.smokeTest',
        status: 'skipped',
        details: 'Skipped by request',
        durationMs: 0
      })
      details.voice = { skipped: true }
    }
    
    // =========================================================================
    // Step 3: Get provisioning summary
    // =========================================================================
    const provisioningStartTime = Date.now()
    const provisioningResult = await tenantProvisioningSummary.execute({ businessId }, ctx)
    
    // Determine provisioning status
    let provisioningStatus = 'done'
    if (!provisioningResult.exists) {
      provisioningStatus = 'failed'
      ready = false
    } else if (provisioningResult.provisioningScore < 100) {
      provisioningStatus = 'in_progress'
    }
    
    checklist.push({
      step: 3,
      item: 'Provisioning',
      tool: 'tenant.provisioningSummary',
      status: provisioningStatus,
      details: provisioningResult.exists 
        ? `${provisioningResult.provisioningScore}% complete` 
        : 'Tenant not found',
      durationMs: Date.now() - provisioningStartTime
    })
    
    details.provisioning = {
      exists: provisioningResult.exists,
      score: provisioningResult.provisioningScore,
      subscription: provisioningResult.subscription,
      calendar: provisioningResult.calendar,
      scheduling: provisioningResult.scheduling,
      voice: provisioningResult.voice,
      eventTypes: provisioningResult.eventTypes,
      checklist: provisioningResult.checklist,
    }
    
    // =========================================================================
    // Build response
    // =========================================================================
    const totalDurationMs = Date.now() - startTime
    
    // Determine overall readiness
    const allStepsDone = checklist.every(c => c.status === 'done' || c.status === 'skipped' || c.status === 'warning')
    ready = ready && allStepsDone
    
    // Add recommendations
    const recommendations = []
    
    if (!details.provisioning?.subscription?.active) {
      recommendations.push({
        priority: 'high',
        item: 'subscription',
        message: 'Activate subscription to unlock all features'
      })
    }
    
    if (!details.provisioning?.calendar?.connected) {
      recommendations.push({
        priority: 'medium', 
        item: 'calendar',
        message: 'Connect Google Calendar for availability sync'
      })
    }
    
    if (!details.provisioning?.scheduling?.hasAvailability) {
      recommendations.push({
        priority: 'medium',
        item: 'availability',
        message: 'Configure availability hours'
      })
    }
    
    if (details.voice?.warning) {
      recommendations.push({
        priority: 'low',
        item: 'voice',
        message: details.voice.warning
      })
    }
    
    return {
      ok: true,
      businessId,
      ready,
      readyMessage: ready 
        ? 'Tenant is fully bootstrapped and ready' 
        : `Tenant requires attention (${recommendations.length} recommendations)`,
      checklist,
      recommendations,
      details,
      dryRun,
      durationMs: totalDurationMs,
      summary: dryRun
        ? `[DRY RUN] Would bootstrap tenant ${businessId}`
        : `Bootstrapped tenant ${businessId} - ${ready ? 'Ready' : 'Needs attention'}`
    }
    
  } catch (error) {
    return {
      ok: false,
      businessId,
      ready: false,
      error: {
        code: 'BOOTSTRAP_ERROR',
        message: error.message,
        step: checklist.length + 1
      },
      checklist,
      details,
      summary: `Bootstrap failed: ${error.message}`
    }
  }
}

export default {
  name: 'tenant.bootstrap',
  description: 'Orchestrate complete tenant onboarding (ensure + voice test + provisioning summary)',
  schema,
  execute
}
