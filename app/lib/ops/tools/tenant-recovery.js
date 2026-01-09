/**
 * Tool: tenant.recovery
 * 
 * Golden Workflow - Diagnose and recover unhealthy tenants by re-validating 
 * voice configuration, billing status, and re-running provisioning checks.
 * 
 * Use this when a tenant reports issues or after infrastructure changes.
 * 
 * Category: tenant
 * Risk: medium (mutates data when autoFix=true)
 * Mutates: true
 * Requires Approval: false (read-heavy, safe to auto-run)
 * Dry Run: Supported
 */

import { z } from 'zod'

export const name = 'tenant.recovery'

export const description = 'Diagnose and recover unhealthy tenants by re-validating voice configuration, billing status, and re-running provisioning checks. Use this when a tenant reports issues or after infrastructure changes.'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  runVoiceTest: z.boolean().default(true).describe('Run voice diagnostics'),
  recheckBilling: z.boolean().default(true).describe('Re-check billing/Stripe status'),
  autoFix: z.boolean().default(false).describe('If true, attempt to fix issues found')
})

// Import other tools for orchestration
async function loadTool(toolPath) {
  try {
    return await import(toolPath)
  } catch (err) {
    console.error(`Failed to load tool: ${toolPath}`, err)
    return null
  }
}

/**
 * Execute tenant.recovery
 * 
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context { db, requestId, dryRun, mode }
 * @returns {Promise<object>} Recovery report
 */
export async function execute(args, ctx) {
  const { businessId, runVoiceTest = true, recheckBilling = true, autoFix = false } = args
  const { db, requestId, dryRun = false, mode = 'execute' } = ctx
  
  console.log(`[ops:${requestId}] tenant.recovery: Starting recovery for ${businessId} (mode=${mode}, dryRun=${dryRun}, autoFix=${autoFix})`)
  
  // Plan mode - return what would be done
  if (mode === 'plan') {
    return buildPlan(args, ctx)
  }
  
  // Dry run mode - simulate without executing
  if (dryRun) {
    return buildDryRunResult(args, ctx)
  }
  
  // Execute actual recovery
  return executeRecovery(args, ctx)
}

/**
 * Build execution plan
 */
function buildPlan(args, ctx) {
  const { businessId, runVoiceTest, recheckBilling, autoFix } = args
  const { requestId } = ctx
  
  const steps = [
    {
      step: 1,
      action: 'tenant.status',
      description: 'Get current tenant status and identify issues',
      willExecute: true
    }
  ]
  
  if (runVoiceTest) {
    steps.push({
      step: steps.length + 1,
      action: 'voice.diagnostics',
      description: 'Run voice service connectivity and latency tests',
      willExecute: true
    })
  }
  
  if (recheckBilling) {
    steps.push({
      step: steps.length + 1,
      action: 'billing.validateStripeConfig',
      description: 'Validate Stripe configuration and subscription status',
      willExecute: true
    })
  }
  
  steps.push({
    step: steps.length + 1,
    action: 'aggregate_results',
    description: 'Aggregate all check results and determine recovery status',
    willExecute: true
  })
  
  if (autoFix) {
    steps.push({
      step: steps.length + 1,
      action: 'auto_fix',
      description: 'Attempt automatic fixes for issues found (conditional)',
      willExecute: true,
      conditional: true,
      note: 'Only executes if issues are found'
    })
  }
  
  console.log(`[ops:${requestId}] tenant.recovery: Plan generated with ${steps.length} steps`)
  
  return {
    ok: true,
    businessId,
    mode: 'plan',
    executed: false,
    plan: {
      steps,
      totalSteps: steps.length,
      options: {
        runVoiceTest,
        recheckBilling,
        autoFix
      },
      warnings: autoFix ? ['autoFix=true will attempt to modify data if issues are found'] : []
    },
    recommendations: [
      'Review the plan steps before executing',
      autoFix ? 'autoFix is enabled - data may be modified' : 'autoFix is disabled - read-only checks'
    ]
  }
}

/**
 * Build dry run result
 */
function buildDryRunResult(args, ctx) {
  const { businessId, runVoiceTest, recheckBilling, autoFix } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] tenant.recovery: Dry run - showing what would be done`)
  
  return {
    ok: true,
    businessId,
    mode: 'dryRun',
    executed: false,
    wouldExecute: {
      tenantStatus: true,
      voiceDiagnostics: runVoiceTest,
      billingValidation: recheckBilling,
      autoFix: autoFix
    },
    simulatedResult: {
      recoveryStatus: 'would_be_determined',
      issuesFound: 'would_be_counted',
      issuesFixed: autoFix ? 'would_be_attempted' : 0,
      checks: {
        voice: runVoiceTest ? { status: 'would_run' } : { status: 'skipped' },
        billing: recheckBilling ? { status: 'would_run' } : { status: 'skipped' },
        provisioning: { status: 'would_run' }
      },
      actions: autoFix ? ['Potential fixes would be attempted'] : ['No fixes - read-only mode'],
      recommendations: ['Execute without dryRun to see actual results']
    }
  }
}

/**
 * Execute actual recovery workflow
 */
async function executeRecovery(args, ctx) {
  const { businessId, runVoiceTest, recheckBilling, autoFix } = args
  const { db, requestId } = ctx
  
  const results = {
    businessId,
    recoveryStatus: 'healthy', // Will be updated based on findings
    issuesFound: 0,
    issuesFixed: 0,
    checks: {
      voice: { status: 'skipped' },
      billing: { status: 'skipped' },
      provisioning: { ready: false, message: 'Not checked yet' }
    },
    actions: [],
    recommendations: [],
    details: {}
  }
  
  const issues = []
  
  // ==========================================================================
  // Step 1: Get current tenant status
  // ==========================================================================
  console.log(`[ops:${requestId}] tenant.recovery: Step 1 - Checking tenant status`)
  
  try {
    const tenantStatusTool = await loadTool('./tenant-status.js')
    if (tenantStatusTool) {
      const statusResult = await tenantStatusTool.execute({ businessId }, ctx)
      results.details.tenantStatus = statusResult
      
      if (!statusResult.ok) {
        issues.push({ type: 'tenant_status', severity: 'high', message: 'Failed to get tenant status' })
      } else if (!statusResult.summary?.ready) {
        issues.push({ type: 'tenant_not_ready', severity: 'medium', message: statusResult.summary?.readyMessage || 'Tenant not fully operational' })
        
        // Add recommendations from tenant status
        if (statusResult.recommendations) {
          results.recommendations.push(...statusResult.recommendations)
        }
        
        // Check for failed items
        const failedChecks = (statusResult.checks || []).filter(c => c.status === 'failed')
        for (const check of failedChecks) {
          issues.push({ type: `tenant_${check.item}`, severity: 'high', message: check.details })
        }
      }
      
      results.checks.provisioning = {
        ready: statusResult.summary?.ready || false,
        message: statusResult.summary?.readyMessage || 'Unknown'
      }
    }
  } catch (err) {
    console.error(`[ops:${requestId}] tenant.recovery: tenant.status failed:`, err)
    issues.push({ type: 'tenant_status_error', severity: 'high', message: err.message })
    results.details.tenantStatusError = err.message
  }
  
  // ==========================================================================
  // Step 2: Voice diagnostics (optional)
  // ==========================================================================
  if (runVoiceTest) {
    console.log(`[ops:${requestId}] tenant.recovery: Step 2 - Running voice diagnostics`)
    
    try {
      const voiceTool = await loadTool('./voice-diagnostics.js')
      if (voiceTool) {
        const voiceResult = await voiceTool.execute({ businessId, timeoutMs: 5000 }, ctx)
        results.details.voiceDiagnostics = voiceResult
        
        results.checks.voice = {
          status: voiceResult.overallStatus || 'unknown',
          latencyMs: voiceResult.summary?.avgLatencyMs,
          error: voiceResult.overallStatus !== 'healthy' ? voiceResult.statusReason : undefined
        }
        
        if (voiceResult.overallStatus === 'critical' || voiceResult.overallStatus === 'degraded') {
          issues.push({
            type: 'voice_unhealthy',
            severity: voiceResult.overallStatus === 'critical' ? 'high' : 'medium',
            message: voiceResult.statusReason || 'Voice services unhealthy'
          })
          
          // Add unhealthy targets to recommendations
          const unhealthyTargets = (voiceResult.results || []).filter(r => 
            ['unhealthy', 'error', 'timeout', 'unreachable'].includes(r.status)
          )
          for (const target of unhealthyTargets) {
            results.recommendations.push(`Check ${target.target}: ${target.reason}`)
          }
        }
      }
    } catch (err) {
      console.error(`[ops:${requestId}] tenant.recovery: voice.diagnostics failed:`, err)
      issues.push({ type: 'voice_check_error', severity: 'medium', message: err.message })
      results.checks.voice = { status: 'error', error: err.message }
    }
  } else {
    results.actions.push('Skipped voice diagnostics (runVoiceTest=false)')
  }
  
  // ==========================================================================
  // Step 3: Billing validation (optional)
  // ==========================================================================
  if (recheckBilling) {
    console.log(`[ops:${requestId}] tenant.recovery: Step 3 - Validating billing configuration`)
    
    try {
      const billingTool = await loadTool('./billing-validate-stripe.js')
      if (billingTool) {
        const billingResult = await billingTool.execute({ businessId }, ctx)
        results.details.billingValidation = billingResult
        
        results.checks.billing = {
          status: billingResult.valid ? 'healthy' : 'unhealthy',
          valid: billingResult.valid || false,
          error: !billingResult.valid ? billingResult.message : undefined
        }
        
        if (!billingResult.valid) {
          issues.push({
            type: 'billing_invalid',
            severity: 'high',
            message: billingResult.message || 'Billing configuration invalid'
          })
          
          // Add billing-specific recommendations
          if (billingResult.checks) {
            const failedBillingChecks = billingResult.checks.filter(c => c.status === 'failed')
            for (const check of failedBillingChecks) {
              results.recommendations.push(`Billing: ${check.details || check.item}`)
            }
          }
        }
      } else {
        // Fallback: Check billing directly from user record
        const user = await db.collection('users').findOne({ id: businessId })
        if (user) {
          const hasStripe = !!(user.subscription?.stripeCustomerId && user.subscription?.stripeSubscriptionId)
          const isActive = user.subscription?.status === 'active'
          
          results.checks.billing = {
            status: hasStripe && isActive ? 'healthy' : 'warning',
            valid: hasStripe && isActive,
            error: !hasStripe ? 'Missing Stripe configuration' : (!isActive ? 'Subscription not active' : undefined)
          }
          
          if (!hasStripe || !isActive) {
            issues.push({
              type: 'billing_warning',
              severity: 'medium',
              message: !hasStripe ? 'Stripe not configured' : 'Subscription not active'
            })
          }
        }
      }
    } catch (err) {
      console.error(`[ops:${requestId}] tenant.recovery: billing check failed:`, err)
      issues.push({ type: 'billing_check_error', severity: 'medium', message: err.message })
      results.checks.billing = { status: 'error', valid: false, error: err.message }
    }
  } else {
    results.actions.push('Skipped billing validation (recheckBilling=false)')
  }
  
  // ==========================================================================
  // Step 4: AutoFix (if enabled and issues found)
  // ==========================================================================
  if (autoFix && issues.length > 0) {
    console.log(`[ops:${requestId}] tenant.recovery: Step 4 - Attempting auto-fix for ${issues.length} issue(s)`)
    results.actions.push(`AutoFix enabled: Found ${issues.length} issue(s) to address`)
    
    // Try to fix voice issues
    const voiceIssues = issues.filter(i => i.type.startsWith('voice_'))
    if (voiceIssues.length > 0) {
      results.actions.push('Voice issues detected - recommend checking API keys and service status')
      results.recommendations.push('Voice auto-fix not implemented yet - manual intervention required')
    }
    
    // Try to fix billing issues
    const billingIssues = issues.filter(i => i.type.startsWith('billing_'))
    if (billingIssues.length > 0) {
      try {
        // Attempt to sync prices
        const syncPricesTool = await loadTool('./billing-sync-prices.js')
        if (syncPricesTool) {
          console.log(`[ops:${requestId}] tenant.recovery: Attempting billing.syncPrices`)
          const syncResult = await syncPricesTool.execute({ businessId, mode: 'plan' }, ctx)
          
          if (syncResult.ok && syncResult.summary?.toCreate > 0) {
            results.actions.push(`Billing: Found ${syncResult.summary.toCreate} price(s) to sync`)
            results.recommendations.push('Run billing.syncPrices with mode=execute to apply changes')
          }
          results.details.billingSyncPlan = syncResult
        }
      } catch (err) {
        console.error(`[ops:${requestId}] tenant.recovery: billing sync failed:`, err)
        results.actions.push(`Billing auto-fix failed: ${err.message}`)
      }
      results.issuesFixed += 0 // We only plan, not execute billing changes
    }
    
    // Try to fix provisioning issues
    const provisioningIssues = issues.filter(i => i.type.startsWith('tenant_'))
    if (provisioningIssues.length > 0) {
      results.actions.push('Tenant provisioning issues detected')
      results.recommendations.push('Consider running tenant.bootstrap to complete setup')
    }
  } else if (autoFix) {
    results.actions.push('AutoFix enabled but no issues found')
  }
  
  // ==========================================================================
  // Step 5: Determine final recovery status
  // ==========================================================================
  results.issuesFound = issues.length
  
  if (issues.length === 0) {
    results.recoveryStatus = 'healthy'
    results.recommendations.push('Tenant is healthy - no action needed')
  } else if (results.issuesFixed > 0 && results.issuesFixed >= issues.length) {
    results.recoveryStatus = 'recovered'
    results.recommendations.push('All issues were automatically resolved')
  } else if (issues.some(i => i.severity === 'high')) {
    results.recoveryStatus = 'needs_attention'
    results.recommendations.push('Critical issues found - manual intervention required')
  } else {
    results.recoveryStatus = 'needs_attention'
    results.recommendations.push('Minor issues found - review recommendations')
  }
  
  // Add issues summary to details
  results.details.issues = issues
  
  // Deduplicate recommendations
  results.recommendations = [...new Set(results.recommendations)]
  
  console.log(`[ops:${requestId}] tenant.recovery: Complete - status=${results.recoveryStatus}, issues=${issues.length}, fixed=${results.issuesFixed}`)
  
  return {
    ok: true,
    ...results
  }
}
