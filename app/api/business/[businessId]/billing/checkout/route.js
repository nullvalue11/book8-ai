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
  try {
    const { businessId } = params
    
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }
    
    const stripe = await getStripe()
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: 'Stripe not configured' },
        { status: 400 }
      )
    }
    
    const database = await connect()
    const authResult = await requireAuth(request, database)
    
    if (authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status }
      )
    }
    
    const { user, payload } = authResult
    
    // Get business
    const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
    
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }
    
    // Verify ownership
    if (business.ownerUserId !== payload.sub) {
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
    const basePriceId = priceId || env.STRIPE?.DEFAULT_PRICE_ID || 'price_starter'
    
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
