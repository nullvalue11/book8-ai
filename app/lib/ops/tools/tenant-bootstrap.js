/**
 * tenant.bootstrap Tool
 * 
 * Orchestrates complete tenant onboarding in a single call.
 * Replaces multiple n8n nodes with one atomic operation.
 * 
 * Steps:
 * 1. Ensure tenant exists (tenant.ensure)
 * 2. Validate Stripe configuration (billing.validateStripeConfig)
 * 3. Run voice smoke test (voice.smokeTest)
 * 4. Get provisioning summary (tenant.provisioningSummary)
 * 
 * Returns comprehensive readiness status with consolidated response:
 * {
 *   "ready": true/false,
 *   "checklist": [...],
 *   "details": {...}
 * }
 */

import { z } from 'zod'

export const name = 'tenant.bootstrap'

export const description = 'Orchestrate complete tenant onboarding (ensure + billing check + voice test + provisioning summary)'

// Schema for tenant.bootstrap arguments
export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  name: z.string().optional(),
  skipVoiceTest: z.boolean().optional().default(false),
  skipBillingCheck: z.boolean().optional().default(false),
})

/**
 * Execute the bootstrap tool
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context { db, dryRun, requestId, actor }
 */
export async function execute(args, ctx) {
  const { db, dryRun, requestId } = ctx
  const { businessId, name, skipVoiceTest, skipBillingCheck } = args
  
  const startTime = Date.now()
  const checklist = []
  const details = {}
  let ready = true
  
  // Import sibling tools
  const tenantEnsure = await import('./tenant-ensure.js')
  const billingValidateStripe = await import('./billing-validate-stripe.js')
  const voiceSmokeTest = await import('./voice-smoke-test.js')
  const tenantProvisioningSummary = await import('./tenant-provisioning-summary.js')
  
  try {
    // =========================================================================
    // Step 1: Ensure tenant exists
    // =========================================================================
    const step1Start = Date.now()
    const ensureArgs = { businessId }
    if (name) ensureArgs.name = name
    
    const ensureResult = await tenantEnsure.execute(ensureArgs, ctx)
    
    checklist.push({
      step: 1,
      item: 'Tenant Record',
      tool: 'tenant.ensure',
      status: ensureResult.ok !== false ? 'done' : 'failed',
      details: ensureResult.existed ? 'Already exists' : (ensureResult.created ? 'Created' : 'Checked'),
      durationMs: Date.now() - step1Start
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
    // Step 2: Validate Stripe configuration
    // =========================================================================
    if (!skipBillingCheck) {
      const step2Start = Date.now()
      const billingResult = await billingValidateStripe.execute({ businessId }, ctx)
      
      const billingOk = billingResult.ok !== false && billingResult.stripeConfigured
      
      checklist.push({
        step: 2,
        item: 'Billing Configuration',
        tool: 'billing.validateStripeConfig',
        status: billingOk ? 'done' : 'warning',
        details: billingResult.stripeConfigured 
          ? `Stripe ${billingResult.stripeMode || 'configured'}` 
          : 'Stripe not configured',
        durationMs: Date.now() - step2Start
      })
      
      details.billing = {
        stripeConfigured: billingResult.stripeConfigured,
        stripeMode: billingResult.stripeMode,
        checks: billingResult.checks,
      }
      
      // Billing not configured is a warning, not a blocker
      if (!billingOk) {
        details.billing.warning = 'Stripe is not fully configured - billing features may be limited'
      }
    } else {
      checklist.push({
        step: 2,
        item: 'Billing Configuration',
        tool: 'billing.validateStripeConfig',
        status: 'skipped',
        details: 'Skipped by request',
        durationMs: 0
      })
      details.billing = { skipped: true }
    }
    
    // =========================================================================
    // Step 3: Voice smoke test (optional)
    // =========================================================================
    if (!skipVoiceTest) {
      const step3Start = Date.now()
      const voiceResult = await voiceSmokeTest.execute({ businessId }, ctx)
      
      const voicePassed = voiceResult.ok !== false && voiceResult.passed === voiceResult.total
      
      checklist.push({
        step: 3,
        item: 'Voice Services',
        tool: 'voice.smokeTest',
        status: voicePassed ? 'done' : 'warning',
        details: `${voiceResult.passed || 0}/${voiceResult.total || 0} checks passed`,
        durationMs: Date.now() - step3Start
      })
      
      details.voice = {
        passed: voiceResult.passed,
        total: voiceResult.total,
        checks: voiceResult.checks,
      }
      
      // Voice failures are warnings, not blockers
      if (!voicePassed) {
        details.voice.warning = 'Some voice checks failed - this may affect AI calling features'
      }
    } else {
      checklist.push({
        step: 3,
        item: 'Voice Services',
        tool: 'voice.smokeTest',
        status: 'skipped',
        details: 'Skipped by request',
        durationMs: 0
      })
      details.voice = { skipped: true }
    }
    
    // =========================================================================
    // Step 4: Get provisioning summary
    // =========================================================================
    const step4Start = Date.now()
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
      step: 4,
      item: 'Provisioning Status',
      tool: 'tenant.provisioningSummary',
      status: provisioningStatus,
      details: provisioningResult.exists 
        ? `${provisioningResult.provisioningScore}% complete` 
        : 'Tenant not found',
      durationMs: Date.now() - step4Start
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
    // ready = all critical steps passed (tenant exists, provisioning found)
    // warnings (billing, voice) don't block readiness
    const criticalStepsPassed = checklist.every(c => 
      c.status === 'done' || c.status === 'skipped' || c.status === 'warning' || c.status === 'in_progress'
    )
    ready = ready && criticalStepsPassed
    
    // Add recommendations based on findings
    const recommendations = []
    
    if (!details.provisioning?.subscription?.active) {
      recommendations.push({
        priority: 'high',
        item: 'subscription',
        message: 'Activate subscription to unlock all features'
      })
    }
    
    if (details.billing?.warning) {
      recommendations.push({
        priority: 'high',
        item: 'billing',
        message: details.billing.warning
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
    
    // Calculate summary stats
    const stats = {
      totalSteps: checklist.length,
      completed: checklist.filter(c => c.status === 'done').length,
      warnings: checklist.filter(c => c.status === 'warning').length,
      skipped: checklist.filter(c => c.status === 'skipped').length,
      failed: checklist.filter(c => c.status === 'failed').length,
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
      stats,
      dryRun,
      durationMs: totalDurationMs,
      summary: dryRun
        ? `[DRY RUN] Would bootstrap tenant ${businessId}`
        : `Bootstrapped tenant ${businessId} - ${ready ? 'Ready' : 'Needs attention'} (${stats.completed}/${stats.totalSteps} complete)`
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

const tenantBootstrap = {
  name: 'tenant.bootstrap',
  description: 'Orchestrate complete tenant onboarding (ensure + billing check + voice test + provisioning summary)',
  schema,
  execute
}

export default tenantBootstrap
