/**
 * GET/POST /api/billing/usage/run-daily
 * 
 * Purpose:
 * Daily cron job that reports yesterday's call minutes to Stripe for each active subscriber.
 * Runs at 02:00 UTC daily via Vercel Cron.
 * 
 * Authentication:
 * Protected by Authorization: Bearer <CRON_SECRET> header (Vercel standard pattern).
 * 
 * Flow:
 * 1. Calculate yesterday's UTC window (00:00:00 to 23:59:59)
 * 2. For each tenant with active subscription + stripeCallMinutesItemId:
 *    a. Fetch usage from core-api: GET /internal/usage/summary
 *    b. If minutes > 0, create Stripe usage record with idempotency key
 * 3. Return summary: { ok, date, updated, skipped, failed, failedIds }
 * 
 * Idempotency:
 * Uses Stripe idempotency key format: usage:{businessId}:{YYYY-MM-DD}
 * Safe to retry - will not double-bill.
 * 
 * Request (GET - Vercel Cron):
 * GET /api/billing/usage/run-daily?date=YYYY-MM-DD (optional date override)
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * 
 * Request (POST - Manual):
 * POST /api/billing/usage/run-daily
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 * Body (optional): { "date": "YYYY-MM-DD" }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "date": "2025-01-15",
 *   "updated": 5,
 *   "skipped": 3,
 *   "failed": 1,
 *   "failedIds": ["tenant-123"]
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripeSubscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for processing many tenants

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

/**
 * Verify cron secret using Authorization: Bearer <CRON_SECRET> pattern
 */
function verifyCronAuth(request) {
  const cronSecret = env.CRON_SECRET
  if (!cronSecret) {
    return { valid: false, error: 'CRON_SECRET not configured' }
  }
  
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' }
  }
  
  // Support both "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  
  if (token !== cronSecret) {
    return { valid: false, error: 'Invalid cron secret' }
  }
  
  return { valid: true }
}

/**
 * Get yesterday's date range in UTC
 * @param {string} [overrideDate] - Optional YYYY-MM-DD to use instead of yesterday
 * @returns {{ date: string, from: string, to: string }}
 */
function getYesterdayWindow(overrideDate = null) {
  let targetDate
  
  if (overrideDate) {
    // Validate format
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(overrideDate)
    if (!match) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.')
    }
    targetDate = new Date(`${overrideDate}T00:00:00.000Z`)
  } else {
    // Default to yesterday UTC
    targetDate = new Date()
    targetDate.setUTCDate(targetDate.getUTCDate() - 1)
    targetDate.setUTCHours(0, 0, 0, 0)
  }
  
  const year = targetDate.getUTCFullYear()
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getUTCDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  
  return {
    date: dateStr,
    from: `${dateStr}T00:00:00.000Z`,
    to: `${dateStr}T23:59:59.999Z`
  }
}

/**
 * Fetch usage from core-api
 * @param {string} businessId - The tenant's business ID
 * @param {string} from - ISO start date
 * @param {string} to - ISO end date
 * @returns {Promise<{ minutes: number, error: string|null }>}
 */
async function fetchUsageFromCoreApi(businessId, from, to) {
  const baseUrl = env.CORE_API_BASE_URL
  const secret = env.CORE_API_INTERNAL_SECRET
  
  if (!baseUrl || !secret) {
    return { minutes: 0, error: 'CORE_API not configured' }
  }
  
  try {
    const url = new URL('/internal/usage/summary', baseUrl)
    url.searchParams.set('businessId', businessId)
    url.searchParams.set('from', from)
    url.searchParams.set('to', to)
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-book8-internal-secret': secret,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(30000) // 30s timeout
    })
    
    if (!response.ok) {
      const text = await response.text()
      return { minutes: 0, error: `Core API error: ${response.status} ${text}` }
    }
    
    const data = await response.json()
    
    // Handle response format: { ok, minutes } or { totalMinutes } etc.
    const minutes = data.minutes ?? data.totalMinutes ?? data.usage?.minutes ?? 0
    
    return { minutes: Math.floor(minutes), error: null }
    
  } catch (error) {
    return { minutes: 0, error: `Core API fetch failed: ${error.message}` }
  }
}

/**
 * Report usage to Stripe
 * @param {Stripe} stripe - Stripe SDK instance
 * @param {string} subscriptionItemId - The metered subscription item ID
 * @param {number} quantity - Minutes to report
 * @param {string} idempotencyKey - Stripe idempotency key
 * @param {number} timestamp - Unix timestamp for the usage
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function reportUsageToStripe(stripe, subscriptionItemId, quantity, idempotencyKey, timestamp) {
  try {
    await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp,
        action: 'increment'
      },
      {
        idempotencyKey
      }
    )
    
    return { success: true, error: null }
    
  } catch (error) {
    // Handle idempotency - if already reported, treat as success
    if (error.code === 'idempotent_request_processing' || 
        error.message?.includes('idempotent')) {
      return { success: true, error: null, alreadyReported: true }
    }
    
    return { success: false, error: `Stripe error: ${error.message}` }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

/**
 * Core handler logic shared by GET and POST
 */
async function runDailyUsageReport(request, overrideDate = null) {
  const startTime = Date.now()
  console.log('[billing/usage/run-daily] Starting daily usage report...')
  
  // 1. Verify cron auth
  const authCheck = verifyCronAuth(request)
  if (!authCheck.valid) {
    console.log('[billing/usage/run-daily] Auth failed:', authCheck.error)
    return NextResponse.json(
      { ok: false, error: authCheck.error },
      { status: 401 }
    )
  }
  
  // 2. Check Stripe configuration
  const stripe = await getStripe()
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: 'Stripe not configured' },
      { status: 400 }
    )
  }
  
  try {
    // 3. Get date window
    let dateWindow
    try {
      dateWindow = getYesterdayWindow(overrideDate)
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      )
    }
    
    console.log(`[billing/usage/run-daily] Processing date: ${dateWindow.date} (${dateWindow.from} to ${dateWindow.to})`)
    
    const database = await connect()
    
    // 5. Diagnostic counts - understand what's in the DB
    const diagnostics = {
      hasSubId: 0,
      hasMinutesItemId: 0,
      activeOrTrialing: 0,
      selected: 0,
      selectionModel: 'users'  // Collection we're querying
    }
    
    // Count users with stripeSubscriptionId
    diagnostics.hasSubId = await database.collection('users').countDocuments({
      'subscription.stripeSubscriptionId': { $exists: true, $ne: null }
    })
    
    // Count users with stripeCallMinutesItemId
    diagnostics.hasMinutesItemId = await database.collection('users').countDocuments({
      'subscription.stripeCallMinutesItemId': { $exists: true, $ne: null }
    })
    
    // Count users with active or trialing status
    diagnostics.activeOrTrialing = await database.collection('users').countDocuments({
      'subscription.status': { $in: ['active', 'trialing'] }
    })
    
    console.log(`[billing/usage/run-daily] Diagnostics:`, diagnostics)
    
    // Selection query - require BOTH stripeCallMinutesItemId AND active/trialing status
    const selectionQuery = {
      'subscription.stripeCallMinutesItemId': { $exists: true, $ne: null },
      'subscription.status': { $in: ['active', 'trialing'] }
    }
    
    const tenantsWithSubscriptions = await database.collection('users').find(selectionQuery).toArray()
    diagnostics.selected = tenantsWithSubscriptions.length
    
    console.log(`[billing/usage/run-daily] Found ${tenantsWithSubscriptions.length} tenants with active subscriptions`)
    console.log(`[billing/usage/run-daily] Selection query:`, JSON.stringify(selectionQuery))
    
    const summary = {
      ok: true,
      date: dateWindow.date,
      total: tenantsWithSubscriptions.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      failedIds: [],
      debug: diagnostics,
      details: [] // For debugging, can be removed in production
    }
    
    // Calculate end-of-day timestamp for Stripe usage record
    const endOfDayTimestamp = Math.floor(new Date(dateWindow.to).getTime() / 1000)
    
    // 6. Process each tenant
    for (const tenant of tenantsWithSubscriptions) {
      const tenantId = tenant.id
      const businessId = tenant.businessId || tenantId // Use businessId if available, fallback to tenant id
      const subscriptionItemId = tenant.subscription?.stripeCallMinutesItemId
      
      if (!subscriptionItemId) {
        console.log(`[billing/usage/run-daily] Tenant ${tenantId}: No stripeCallMinutesItemId, skipping`)
        summary.skipped++
        continue
      }
      
      // Generate idempotency key
      const idempotencyKey = `usage:${businessId}:${dateWindow.date}`
      
      try {
        // 6a. Fetch usage from core-api
        const usageResult = await fetchUsageFromCoreApi(businessId, dateWindow.from, dateWindow.to)
        
        if (usageResult.error) {
          console.error(`[billing/usage/run-daily] Tenant ${tenantId}: Core API error - ${usageResult.error}`)
          summary.failed++
          summary.failedIds.push(tenantId)
          summary.details.push({ tenantId, error: usageResult.error })
          continue
        }
        
        const minutes = usageResult.minutes
        
        // 6b. Skip if no usage
        if (minutes <= 0) {
          console.log(`[billing/usage/run-daily] Tenant ${tenantId}: 0 minutes, skipping`)
          summary.skipped++
          continue
        }
        
        // 6c. Report to Stripe
        const stripeResult = await reportUsageToStripe(
          stripe,
          subscriptionItemId,
          minutes,
          idempotencyKey,
          endOfDayTimestamp
        )
        
        if (!stripeResult.success) {
          console.error(`[billing/usage/run-daily] Tenant ${tenantId}: Stripe error - ${stripeResult.error}`)
          summary.failed++
          summary.failedIds.push(tenantId)
          summary.details.push({ tenantId, minutes, error: stripeResult.error })
          continue
        }
        
        // Success
        console.log(`[billing/usage/run-daily] Tenant ${tenantId}: Reported ${minutes} minutes${stripeResult.alreadyReported ? ' (already reported)' : ''}`)
        summary.updated++
        summary.details.push({ tenantId, minutes, alreadyReported: stripeResult.alreadyReported || false })
        
      } catch (error) {
        console.error(`[billing/usage/run-daily] Tenant ${tenantId}: Unexpected error - ${error.message}`)
        summary.failed++
        summary.failedIds.push(tenantId)
        summary.details.push({ tenantId, error: error.message })
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`[billing/usage/run-daily] Completed in ${duration}ms:`, {
      date: summary.date,
      updated: summary.updated,
      skipped: summary.skipped,
      failed: summary.failed
    })
    
    // Remove details from production response (keep for debugging)
    const { details, ...responseWithoutDetails } = summary
    
    return NextResponse.json(responseWithoutDetails)
    
  } catch (error) {
    console.error('[billing/usage/run-daily] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET handler - Used by Vercel Cron
 * Accepts ?date=YYYY-MM-DD query param for testing
 */
export async function GET(request) {
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')
  return runDailyUsageReport(request, dateParam)
}

/**
 * POST handler - For manual runs
 * Accepts { "date": "YYYY-MM-DD" } in body for testing
 */
export async function POST(request) {
  let overrideDate = null
  try {
    const body = await request.json().catch(() => ({}))
    if (body.date) {
      overrideDate = body.date
    }
  } catch {}
  return runDailyUsageReport(request, overrideDate)
}
