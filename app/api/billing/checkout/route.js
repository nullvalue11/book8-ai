/**
 * POST /api/billing/checkout
 * 
 * Purpose:
 * Create a Stripe Checkout Session for subscription creation or upgrade.
 * Includes both the base plan and the metered call minutes item.
 * 
 * Authentication:
 * Requires JWT Bearer token.
 * 
 * Request Body:
 * {
 *   "priceId": "price_xxx" // Base plan price ID (starter/growth/enterprise)
 * }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "checkoutUrl": "https://checkout.stripe.com/...",
 *   "sessionId": "cs_xxx"
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env, debugLog } from '@/lib/env'
import {
  getStripe,
  buildSubscriptionLineItems,
  generateIdempotencyKey
} from '@/lib/stripeSubscription'
import { updateSubscriptionFields } from '@/lib/subscriptionUpdate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(request) {
  let requestPriceId = null // Track for error handling
  
  try {
    const stripe = await getStripe()
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: 'Stripe not configured' },
        { status: 400 }
      )
    }
    
    const database = await connect()
    const auth = await requireAuth(request, database)
    if (auth.error) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      )
    }
    
    const user = auth.user
    const body = await request.json()
    const { priceId, businessId, returnTo } = body
    requestPriceId = priceId // Store for error handling
    
    if (!priceId) {
      return NextResponse.json(
        { ok: false, error: 'Missing priceId' },
        { status: 400 }
      )
    }
    
    // Validate price ID is one of our known plans
    const validPrices = [
      env.STRIPE?.PRICE_STARTER,
      env.STRIPE?.PRICE_GROWTH,
      env.STRIPE?.PRICE_ENTERPRISE
    ].filter(Boolean)
    
    if (validPrices.length > 0 && !validPrices.includes(priceId)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid price ID' },
        { status: 400 }
      )
    }
    
    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
          ...(businessId && { businessId })
        }
      })
      customerId = customer.id
      
      // Store customer ID (using atomic update to handle subscription: null)
      await updateSubscriptionFields(database.collection('users'), user.id, {
        stripeCustomerId: customerId,
        updatedAt: new Date().toISOString()
      })
    }
    
    // Build line items (base plan + metered minutes)
    const lineItems = buildSubscriptionLineItems(priceId)

    // Success/cancel URLs: setup wizard vs dashboard vs anonymous checkout
    const baseRoot = String(env.BASE_URL || '').replace(/\/$/, '')
    let successUrl
    let cancelUrl
    if (returnTo === 'setup' && businessId && typeof businessId === 'string') {
      const bid = businessId.trim()
      const ok = new URL(`${baseRoot}/setup`)
      ok.searchParams.set('step', '3')
      ok.searchParams.set('businessId', bid)
      ok.searchParams.set('checkout', 'success')
      successUrl = ok.toString()
      const cancel = new URL(`${baseRoot}/setup`)
      cancel.searchParams.set('step', '2')
      cancel.searchParams.set('businessId', bid)
      cancel.searchParams.set('checkout', 'canceled')
      cancelUrl = cancel.toString()
    } else if (businessId) {
      successUrl = `${baseRoot}/dashboard/business?checkout=success&businessId=${encodeURIComponent(businessId)}`
      cancelUrl = `${baseRoot}/dashboard/business?checkout=canceled&businessId=${encodeURIComponent(businessId)}`
    } else {
      successUrl = `${baseRoot}/?checkout=success`
      cancelUrl = `${baseRoot}/pricing?canceled=true`
    }
    
    // Resolve business and enrich metadata for tenant provisioning in webhook.
    // CRITICAL: Use actual businessId (biz_xxx) and business name from DB, never raw input.
    let resolvedBusiness = null
    let planName = 'starter'
    if (businessId && typeof businessId === 'string' && businessId.trim()) {
      const bizId = businessId.trim()
      resolvedBusiness = await database.collection('businesses').findOne({
        $or: [{ businessId: bizId }, { id: bizId }]
      })
      if (priceId === env.STRIPE?.PRICE_ENTERPRISE) planName = 'enterprise'
      else if (priceId === env.STRIPE?.PRICE_GROWTH) planName = 'growth'
      else if (priceId === env.STRIPE?.PRICE_STARTER) planName = 'starter'
    }

    const sessionPayload = {
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        priceId: priceId,
        ...(resolvedBusiness && {
          businessId: resolvedBusiness.businessId || resolvedBusiness.id,
          businessName: resolvedBusiness.name || null,
          ownerEmail: resolvedBusiness.ownerEmail || user.email || null,
          timezone: resolvedBusiness.timezone || 'America/Toronto',
          ...(resolvedBusiness.category != null && { category: resolvedBusiness.category }),
          plan: planName
        }),
        numberSetupMethod: 'pending'
      },
      subscription_data: (() => {
        const meta = {
          userId: user.id,
          priceId: priceId,
          ...(resolvedBusiness && {
            businessId: resolvedBusiness.businessId || resolvedBusiness.id
          })
        }
        const sub = { metadata: meta }
        if (priceId === env.STRIPE?.PRICE_GROWTH) {
          sub.trial_period_days = env.TRIAL_PERIOD_DAYS ?? 14
          meta.plan = 'growth'
          meta.trialStart = new Date().toISOString()
        }
        return sub
      })()
    }

    let session
    const idempotencyKeyBase = generateIdempotencyKey('checkout', user.id, priceId)
    const idempotencyKey = `${idempotencyKeyBase}:${crypto.randomUUID()}`

    try {
      session = await stripe.checkout.sessions.create(sessionPayload, { idempotencyKey })
    } catch (idemError) {
      const isIdempotencyConflict =
        idemError?.code === 'idempotency_key_inuse' ||
        (typeof idemError?.message === 'string' && idemError.message.includes('Keys for idempotent requests'))
      if (isIdempotencyConflict) {
        const retryKey = `${idempotencyKeyBase}:${crypto.randomUUID()}`
        session = await stripe.checkout.sessions.create(sessionPayload, { idempotencyKey: retryKey })
      } else {
        throw idemError
      }
    }

    debugLog(`[billing/checkout] Created session ${session.id} for user ${user.id}, plan ${priceId}`)
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id
    })
    
  } catch (error) {
    console.error('[billing/checkout] Error:', error)
    
    // Enhanced error handling for Stripe price errors
    const errorMessage = error.message || ''
    
    // Check for "No such price" error
    if (errorMessage.includes('No such price') || error.code === 'resource_missing') {
      // Determine Stripe mode
      let stripeMode = 'unknown'
      const secretKey = env.STRIPE?.SECRET_KEY || ''
      if (secretKey.startsWith('sk_test_')) {
        stripeMode = 'test'
      } else if (secretKey.startsWith('sk_live_')) {
        stripeMode = 'live'
      }
      
      return NextResponse.json({
        ok: false,
        error: errorMessage,
        code: 'STRIPE_PRICE_INVALID',
        sentPriceId: requestPriceId,
        envPriceIdsSnapshot: {
          starter: env.STRIPE?.PRICE_STARTER || null,
          growth: env.STRIPE?.PRICE_GROWTH || null,
          enterprise: env.STRIPE?.PRICE_ENTERPRISE || null,
          metered: env.STRIPE?.PRICE_CALL_MINUTE_METERED || null
        },
        stripeMode,
        hint: 'The price ID does not exist in the current Stripe account/mode. Check that env vars match Stripe dashboard.'
      }, { status: 400 })
    }
    
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
