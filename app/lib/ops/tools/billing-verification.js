/**
 * Tool: billing_verification
 * 
 * Verify billing records for a business within a date range.
 * Compares actual billing against expected amounts, identifies discrepancies,
 * and flags potential issues for review.
 * 
 * Category: billing
 * Risk: low
 * Mutates: false
 * Requires Approval: false
 */

import { z } from 'zod'

export const name = 'billing_verification'

export const description = 'Verify billing records for a business. Compares actual billing against expected amounts, identifies discrepancies, and flags potential issues for review.'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  startDate: z.string().optional().describe('Start date in ISO format (e.g., 2024-01-01). Defaults to current billing period start.'),
  endDate: z.string().optional().describe('End date in ISO format (e.g., 2024-01-31). Defaults to now.'),
  includeDetails: z.boolean().default(true).describe('Include detailed line items in response'),
  tolerancePercent: z.number().min(0).max(100).default(1).describe('Tolerance percentage for flagging discrepancies')
})

/**
 * Execute billing_verification
 * 
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context { db, requestId, dryRun, mode }
 * @returns {Promise<object>} Billing verification result
 */
export async function execute(args, ctx) {
  const { 
    businessId, 
    startDate, 
    endDate, 
    includeDetails = true,
    tolerancePercent = 1
  } = args
  const { db, requestId, dryRun = false, mode = 'execute' } = ctx
  
  console.log(`[ops:${requestId}] billing_verification: Verifying billing for ${businessId} (mode=${mode}, dryRun=${dryRun})`)
  
  // Plan mode - return what would be done
  if (mode === 'plan') {
    return buildPlan(args, ctx)
  }
  
  // Dry run mode - simulate without executing
  if (dryRun) {
    return buildDryRunResult(args, ctx)
  }
  
  // Execute actual verification
  return executeVerification(args, ctx)
}

/**
 * Build execution plan
 */
function buildPlan(args, ctx) {
  const { businessId, startDate, endDate, includeDetails, tolerancePercent } = args
  const { requestId } = ctx
  
  // Calculate date range
  const now = new Date()
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1) // First of current month
  
  const effectiveStartDate = startDate ? new Date(startDate) : defaultStartDate
  const effectiveEndDate = endDate ? new Date(endDate) : now
  
  console.log(`[ops:${requestId}] billing_verification: Plan generated`)
  
  return {
    ok: true,
    businessId,
    mode: 'plan',
    executed: false,
    plan: {
      steps: [
        { order: 1, action: 'fetch_subscription', description: 'Get subscription details and pricing' },
        { order: 2, action: 'fetch_usage', description: 'Get metered usage records (call minutes)' },
        { order: 3, action: 'fetch_invoices', description: 'Get billing invoices from Stripe' },
        { order: 4, action: 'calculate_expected', description: 'Calculate expected billing amounts' },
        { order: 5, action: 'compare_amounts', description: 'Compare actual vs expected' },
        { order: 6, action: 'identify_discrepancies', description: 'Flag any discrepancies above tolerance' }
      ],
      dateRange: {
        start: effectiveStartDate.toISOString(),
        end: effectiveEndDate.toISOString()
      },
      options: {
        includeDetails,
        tolerancePercent
      },
      estimatedDurationMs: 200,
      description: `Verify billing for business ${businessId} from ${effectiveStartDate.toISOString()} to ${effectiveEndDate.toISOString()}`
    },
    recommendations: [
      'Execute without plan mode to run actual verification',
      'Use includeDetails=false for faster summary-only verification'
    ]
  }
}

/**
 * Build dry run result
 */
function buildDryRunResult(args, ctx) {
  const { businessId } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] billing_verification: Dry run - showing what would be done`)
  
  return {
    ok: true,
    businessId,
    mode: 'dryRun',
    executed: false,
    wouldExecute: {
      collections: ['users', 'billing_records', 'call_logs'],
      operations: ['read'],
      externalApis: ['stripe']
    },
    simulatedResult: {
      status: 'would_be_determined',
      totalBilled: 'would_be_calculated',
      totalExpected: 'would_be_calculated',
      discrepancies: 'would_be_identified'
    },
    recommendations: ['Execute without dryRun to see actual results']
  }
}

/**
 * Execute actual verification
 */
async function executeVerification(args, ctx) {
  const { 
    businessId, 
    startDate, 
    endDate, 
    includeDetails = true,
    tolerancePercent = 1
  } = args
  const { db, requestId } = ctx
  
  const startTime = Date.now()
  
  // Calculate date range
  const now = new Date()
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1)
  
  const effectiveStartDate = startDate ? new Date(startDate) : defaultStartDate
  const effectiveEndDate = endDate ? new Date(endDate) : now
  
  const results = {
    businessId,
    dateRange: {
      start: effectiveStartDate.toISOString(),
      end: effectiveEndDate.toISOString()
    },
    status: 'verified', // Will be updated based on findings
    totalBilled: 0,
    totalExpected: 0,
    difference: 0,
    differencePercent: 0,
    discrepancies: [],
    lineItems: [],
    subscription: null,
    usage: null,
    flags: [],
    recommendations: []
  }
  
  try {
    // ==========================================================================
    // Step 1: Get subscription details
    // ==========================================================================
    console.log(`[ops:${requestId}] billing_verification: Step 1 - Fetching subscription`)
    
    const user = await db.collection('users').findOne({ id: businessId })
    
    if (!user) {
      return {
        ok: false,
        businessId,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: `Business '${businessId}' not found`
        },
        status: 'error'
      }
    }
    
    const subscription = user.subscription || {}
    results.subscription = {
      status: subscription.status || 'none',
      plan: subscription.stripePriceId || 'unknown',
      stripeCustomerId: subscription.stripeCustomerId ? '***' + subscription.stripeCustomerId.slice(-4) : null,
      stripeSubscriptionId: subscription.stripeSubscriptionId ? '***' + subscription.stripeSubscriptionId.slice(-4) : null,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd
    }
    
    // ==========================================================================
    // Step 2: Get usage records (call minutes)
    // ==========================================================================
    console.log(`[ops:${requestId}] billing_verification: Step 2 - Fetching usage records`)
    
    const usageQuery = {
      businessId,
      createdAt: {
        $gte: effectiveStartDate,
        $lte: effectiveEndDate
      }
    }
    
    // Get call logs for usage calculation
    const callLogs = await db.collection('call_logs')
      .find(usageQuery)
      .toArray()
    
    const totalCallMinutes = callLogs.reduce((sum, log) => {
      return sum + Math.ceil((log.durationSeconds || 0) / 60)
    }, 0)
    
    results.usage = {
      totalCalls: callLogs.length,
      totalMinutes: totalCallMinutes,
      billableMinutes: totalCallMinutes // All minutes are billable
    }
    
    // ==========================================================================
    // Step 3: Get billing records
    // ==========================================================================
    console.log(`[ops:${requestId}] billing_verification: Step 3 - Fetching billing records`)
    
    const billingRecords = await db.collection('billing_records')
      .find({
        businessId,
        createdAt: {
          $gte: effectiveStartDate,
          $lte: effectiveEndDate
        }
      })
      .sort({ createdAt: -1 })
      .toArray()
    
    // Calculate total billed from records
    results.totalBilled = billingRecords.reduce((sum, record) => {
      return sum + (record.amount || 0)
    }, 0)
    
    if (includeDetails) {
      results.lineItems = billingRecords.map(record => ({
        id: record.id || record._id?.toString(),
        date: record.createdAt,
        description: record.description || record.type,
        amount: record.amount || 0,
        status: record.status || 'unknown',
        invoiceId: record.invoiceId
      }))
    }
    
    // ==========================================================================
    // Step 4: Calculate expected billing
    // ==========================================================================
    console.log(`[ops:${requestId}] billing_verification: Step 4 - Calculating expected billing`)
    
    // Base subscription cost (placeholder - would come from price configuration)
    const PRICE_PER_MINUTE = 0.10 // $0.10 per minute (example rate)
    const expectedUsageCost = totalCallMinutes * PRICE_PER_MINUTE
    
    // Get base subscription cost from billing records or default
    const subscriptionCost = billingRecords
      .filter(r => r.type === 'subscription')
      .reduce((sum, r) => sum + (r.amount || 0), 0)
    
    results.totalExpected = subscriptionCost + expectedUsageCost
    
    // ==========================================================================
    // Step 5: Compare and identify discrepancies
    // ==========================================================================
    console.log(`[ops:${requestId}] billing_verification: Step 5 - Comparing amounts`)
    
    results.difference = Math.round((results.totalBilled - results.totalExpected) * 100) / 100
    results.differencePercent = results.totalExpected > 0 
      ? Math.round((Math.abs(results.difference) / results.totalExpected) * 10000) / 100
      : 0
    
    // Check for discrepancies
    if (Math.abs(results.differencePercent) > tolerancePercent) {
      results.discrepancies.push({
        type: 'amount_mismatch',
        severity: results.differencePercent > 10 ? 'high' : 'medium',
        expected: results.totalExpected,
        actual: results.totalBilled,
        difference: results.difference,
        differencePercent: results.differencePercent,
        message: `Billing difference of ${results.differencePercent}% exceeds ${tolerancePercent}% tolerance`
      })
    }
    
    // Check for missing usage records
    if (callLogs.length > 0 && billingRecords.length === 0) {
      results.discrepancies.push({
        type: 'missing_billing',
        severity: 'high',
        message: `Found ${callLogs.length} calls but no billing records for the period`
      })
    }
    
    // Check for unbilled minutes
    const billedMinutes = billingRecords
      .filter(r => r.type === 'usage' || r.type === 'metered')
      .reduce((sum, r) => sum + (r.quantity || 0), 0)
    
    if (totalCallMinutes > billedMinutes) {
      results.discrepancies.push({
        type: 'unbilled_usage',
        severity: 'medium',
        unbilledMinutes: totalCallMinutes - billedMinutes,
        message: `${totalCallMinutes - billedMinutes} call minutes may not be billed`
      })
    }
    
    // Check subscription status
    if (subscription.status !== 'active' && callLogs.length > 0) {
      results.flags.push({
        type: 'inactive_subscription',
        message: 'Usage recorded but subscription is not active'
      })
    }
    
    // ==========================================================================
    // Step 6: Determine final status and recommendations
    // ==========================================================================
    if (results.discrepancies.length === 0 && results.flags.length === 0) {
      results.status = 'verified'
      results.recommendations.push('Billing verified - no issues found')
    } else if (results.discrepancies.some(d => d.severity === 'high')) {
      results.status = 'needs_review'
      results.recommendations.push('High-severity discrepancies found - manual review required')
    } else if (results.discrepancies.length > 0) {
      results.status = 'minor_issues'
      results.recommendations.push('Minor discrepancies found - review recommended')
    } else {
      results.status = 'flagged'
      results.recommendations.push('Review flagged items before billing period closes')
    }
    
    // Add specific recommendations based on findings
    if (results.discrepancies.some(d => d.type === 'unbilled_usage')) {
      results.recommendations.push('Run billing.syncUsage to reconcile usage records')
    }
    if (results.flags.some(f => f.type === 'inactive_subscription')) {
      results.recommendations.push('Verify subscription status or pause usage tracking')
    }
    
    const durationMs = Date.now() - startTime
    
    console.log(`[ops:${requestId}] billing_verification: Complete - status=${results.status}, discrepancies=${results.discrepancies.length}`)
    
    return {
      ok: true,
      ...results,
      summary: {
        totalBilled: results.totalBilled,
        totalExpected: results.totalExpected,
        difference: results.difference,
        differencePercent: results.differencePercent,
        discrepancyCount: results.discrepancies.length,
        flagCount: results.flags.length
      },
      _meta: {
        durationMs,
        recordsAnalyzed: {
          billingRecords: billingRecords.length,
          callLogs: callLogs.length
        }
      }
    }
    
  } catch (err) {
    console.error(`[ops:${requestId}] billing_verification: Verification failed:`, err)
    
    return {
      ok: false,
      businessId,
      error: {
        code: 'VERIFICATION_FAILED',
        message: err.message
      },
      status: 'error'
    }
  }
}
