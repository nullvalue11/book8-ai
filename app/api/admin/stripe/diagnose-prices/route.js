/**
 * GET /api/admin/stripe/diagnose-prices
 * 
 * Purpose:
 * Diagnostic endpoint to verify Stripe configuration and price IDs.
 * Returns current environment config and validates each price exists in Stripe.
 * 
 * Authentication:
 * Protected by ADMIN_TOKEN or CRON_SECRET.
 * Header: x-admin-token: <ADMIN_TOKEN>
 * 
 * Response:
 * {
 *   "ok": true,
 *   "stripeMode": "test",
 *   "stripeConfigured": true,
 *   "envSnapshot": {
 *     "hasSecretKey": true,
 *     "hasPublishableKey": true,
 *     "hasWebhookSecret": true,
 *     "priceStarter": "price_xxx",
 *     "priceGrowth": "price_xxx",
 *     "priceEnterprise": "price_xxx",
 *     "priceCallMinuteMetered": "price_xxx"
 *   },
 *   "priceValidation": {
 *     "starter": { "exists": true, "product": "prod_xxx", "currency": "cad", "interval": "month" },
 *     "growth": { "exists": true, ... },
 *     "enterprise": { "exists": false, "error": "No such price: ..." },
 *     "callMinuteMetered": { "exists": true, ... }
 *   }
 * }
 */

import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripeSubscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function verifyAdminToken(request) {
  const adminToken = env.ADMIN_TOKEN
  const cronSecret = env.CRON_SECRET
  
  // Check x-admin-token header
  const providedAdminToken = request.headers.get('x-admin-token')
  if (adminToken && providedAdminToken === adminToken) {
    return { valid: true }
  }
  
  // Check Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization') || ''
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { valid: true }
  }
  
  if (!adminToken && !cronSecret) {
    return { valid: false, error: 'ADMIN_TOKEN or CRON_SECRET not configured' }
  }
  
  return { valid: false, error: 'Invalid admin token' }
}

async function validatePrice(stripe, priceId, label) {
  if (!priceId) {
    return { exists: false, error: `${label} price ID not configured in env` }
  }
  
  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product']
    })
    
    return {
      exists: true,
      priceId: price.id,
      product: typeof price.product === 'object' ? price.product.id : price.product,
      productName: typeof price.product === 'object' ? price.product.name : null,
      currency: price.currency,
      unitAmount: price.unit_amount,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        intervalCount: price.recurring.interval_count,
        usageType: price.recurring.usage_type
      } : null,
      active: price.active
    }
  } catch (error) {
    return {
      exists: false,
      priceId: priceId,
      error: error.message
    }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function GET(request) {
  console.log('[admin/stripe/diagnose-prices] Starting diagnostics...')
  
  // 1. Verify admin token
  const authCheck = verifyAdminToken(request)
  if (!authCheck.valid) {
    console.log('[admin/stripe/diagnose-prices] Auth failed:', authCheck.error)
    return NextResponse.json(
      { ok: false, error: authCheck.error },
      { status: 401 }
    )
  }
  
  // 2. Check Stripe configuration
  const stripe = await getStripe()
  
  // Determine Stripe mode from secret key (without exposing the key)
  let stripeMode = 'unknown'
  const secretKey = env.STRIPE?.SECRET_KEY || ''
  if (secretKey.startsWith('sk_test_')) {
    stripeMode = 'test'
  } else if (secretKey.startsWith('sk_live_')) {
    stripeMode = 'live'
  }
  
  // 3. Build env snapshot (without exposing sensitive values)
  const envSnapshot = {
    hasSecretKey: !!env.STRIPE?.SECRET_KEY,
    hasPublishableKey: !!env.STRIPE?.PUBLISHABLE_KEY,
    hasWebhookSecret: !!env.STRIPE?.WEBHOOK_SECRET,
    stripeObjectExists: !!env.STRIPE,
    priceStarter: env.STRIPE?.PRICE_STARTER || null,
    priceGrowth: env.STRIPE?.PRICE_GROWTH || null,
    priceEnterprise: env.STRIPE?.PRICE_ENTERPRISE || null,
    priceCallMinuteMetered: env.STRIPE?.PRICE_CALL_MINUTE_METERED || null
  }
  
  console.log('[admin/stripe/diagnose-prices] Env snapshot:', envSnapshot)
  
  // 4. If Stripe is not configured, return early
  if (!stripe) {
    return NextResponse.json({
      ok: true,
      stripeMode,
      stripeConfigured: false,
      envSnapshot,
      priceValidation: null,
      message: 'Stripe is not configured. Check STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, and STRIPE_WEBHOOK_SECRET.'
    })
  }
  
  // 5. Validate each price in Stripe
  const priceValidation = {
    starter: await validatePrice(stripe, env.STRIPE?.PRICE_STARTER, 'Starter'),
    growth: await validatePrice(stripe, env.STRIPE?.PRICE_GROWTH, 'Growth'),
    enterprise: await validatePrice(stripe, env.STRIPE?.PRICE_ENTERPRISE, 'Enterprise'),
    callMinuteMetered: await validatePrice(stripe, env.STRIPE?.PRICE_CALL_MINUTE_METERED, 'Call Minute Metered')
  }
  
  console.log('[admin/stripe/diagnose-prices] Price validation complete')
  
  // 6. Check for issues
  const issues = []
  if (!envSnapshot.stripeObjectExists) {
    issues.push('env.STRIPE is null - missing required Stripe env vars')
  }
  for (const [name, validation] of Object.entries(priceValidation)) {
    if (!validation.exists) {
      issues.push(`${name}: ${validation.error}`)
    } else if (!validation.active) {
      issues.push(`${name}: Price exists but is not active`)
    }
  }
  
  return NextResponse.json({
    ok: issues.length === 0,
    stripeMode,
    stripeConfigured: true,
    envSnapshot,
    priceValidation,
    issues: issues.length > 0 ? issues : null,
    timestamp: new Date().toISOString()
  })
}
