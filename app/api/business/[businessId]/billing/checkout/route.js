/**
 * POST /api/business/[businessId]/billing/checkout
 * 
 * Create a Stripe Checkout Session for a business subscription.
 * Links the subscription to the business entity.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { COLLECTION_NAME, SUBSCRIPTION_STATUS } from '@/lib/schemas/business'

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

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// Handle GET requests - return helpful error
export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'Use POST method to create a checkout session',
    usage: 'POST /api/business/[businessId]/billing/checkout with Authorization header'
  }, { status: 405 })
}

async function getStripe() {
  try {
    const Stripe = (await import('stripe')).default
    const key = env.STRIPE?.SECRET_KEY
    if (!key) return null
    return new Stripe(key)
  } catch (e) {
    console.error('[business/billing] failed to load stripe', e)
    return null
  }
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user, payload }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function POST(request, { params }) {
  console.log('[business/billing/checkout] POST request received')
  
  try {
    const { businessId } = params
    console.log('[business/billing/checkout] businessId:', businessId)
    
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }
    
    // Check Stripe configuration first
    console.log('[business/billing/checkout] Checking Stripe config...')
    if (!env.STRIPE?.SECRET_KEY) {
      console.error('[business/billing/checkout] STRIPE_SECRET_KEY not configured')
      return NextResponse.json(
        { ok: false, error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to environment.' },
        { status: 500 }
      )
    }
    
    const stripe = await getStripe()
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: 'Failed to initialize Stripe' },
        { status: 500 }
      )
    }
    console.log('[business/billing/checkout] Stripe initialized')
    
    const database = await connect()
    console.log('[business/billing/checkout] Database connected')
    
    const authResult = await requireAuth(request, database)
    
    if (authResult.error) {
      console.log('[business/billing/checkout] Auth failed:', authResult.error)
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status }
      )
    }
    
    const { user, payload } = authResult
    console.log('[business/billing/checkout] User authenticated:', user.id)
    
    // Get business
    const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
    
    if (!business) {
      console.log('[business/billing/checkout] Business not found:', businessId)
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }
    console.log('[business/billing/checkout] Business found:', business.name)
    
    // Verify ownership
    if (business.ownerUserId !== payload.sub) {
      console.log('[business/billing/checkout] Access denied - owner mismatch')
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }
    
    // Check if already subscribed
    if (business.subscription?.status === SUBSCRIPTION_STATUS.ACTIVE) {
      return NextResponse.json({
        ok: false,
        error: 'Business already has an active subscription',
        subscription: {
          status: business.subscription.status,
          stripeCustomerId: business.subscription.stripeCustomerId ? '***' + business.subscription.stripeCustomerId.slice(-4) : null
        }
      }, { status: 409 })
    }
    
    // Parse request body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Use defaults
    }
    
    const { priceId } = body
    
    // Use default price if not specified
    const basePriceId = priceId || env.STRIPE?.DEFAULT_PRICE_ID
    
    // Validate price ID exists
    if (!basePriceId) {
      console.error('[business/billing/checkout] No price ID configured')
      return NextResponse.json({
        ok: false,
        error: 'No Stripe price configured. Please add STRIPE_DEFAULT_PRICE_ID to environment.'
      }, { status: 500 })
    }
    
    // Get or create Stripe customer for business
    let stripeCustomerId = business.subscription?.stripeCustomerId
    
    if (!stripeCustomerId) {
      // Check if user already has a Stripe customer
      if (user.subscription?.stripeCustomerId) {
        stripeCustomerId = user.subscription.stripeCustomerId
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: business.name,
          metadata: {
            userId: user.id,
            businessId: business.businessId,
            businessName: business.name
          }
        })
        stripeCustomerId = customer.id
      }
      
      // Save customer ID to business
      await database.collection(COLLECTION_NAME).updateOne(
        { businessId },
        { 
          $set: { 
            'subscription.stripeCustomerId': stripeCustomerId,
            updatedAt: new Date()
          }
        }
      )
    }
    
    // Build line items
    const lineItems = [
      {
        price: basePriceId,
        quantity: 1
      }
    ]
    
    // Add metered billing item if configured
    const meteredPriceId = env.STRIPE?.METERED_PRICE_ID
    if (meteredPriceId) {
      lineItems.push({
        price: meteredPriceId
      })
    }
    
    // Create checkout session
    const baseUrl = env.BASE_URL || 'http://localhost:3000'
    
    console.log('[business/billing/checkout] Creating session:', {
      businessId: business.businessId,
      customerId: stripeCustomerId,
      priceId: basePriceId,
      baseUrl
    })
    
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${baseUrl}/dashboard/business?checkout=success&businessId=${businessId}`,
      cancel_url: `${baseUrl}/dashboard/business?checkout=canceled&businessId=${businessId}`,
      metadata: {
        userId: user.id,
        businessId: business.businessId,
        businessName: business.name,
        priceId: basePriceId
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          businessId: business.businessId
        }
      }
    })
    
    console.log('[business/billing/checkout] Session created:', session.id)
    
    // Update business with pending subscription info
    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { 
        $set: { 
          'subscription.status': SUBSCRIPTION_STATUS.NONE,
          'subscription.pendingCheckoutSessionId': session.id,
          updatedAt: new Date()
        }
      }
    )
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      businessId
    })
    
  } catch (error) {
    console.error('[business/billing/checkout] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
