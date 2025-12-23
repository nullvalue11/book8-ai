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
import { env } from '@/lib/env'
import {
  getStripe,
  buildSubscriptionLineItems,
  generateIdempotencyKey
} from '@/lib/stripeSubscription'

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
    const { priceId } = body
    
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
          userId: user.id
        }
      })
      customerId = customer.id
      
      // Store customer ID
      await database.collection('users').updateOne(
        { id: user.id },
        { 
          $set: { 
            'subscription.stripeCustomerId': customerId,
            'subscription.updatedAt': new Date().toISOString()
          } 
        }
      )
    }
    
    // Build line items (base plan + metered minutes)
    const lineItems = buildSubscriptionLineItems(priceId)
    
    // Create checkout session with idempotency key
    const idempotencyKey = generateIdempotencyKey('checkout', user.id, priceId)
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: lineItems,
      success_url: `${env.BASE_URL}/dashboard/settings/billing?success=true`,
      cancel_url: `${env.BASE_URL}/dashboard/settings/billing?canceled=true`,
      metadata: {
        userId: user.id,
        priceId: priceId
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          priceId: priceId
        }
      }
    }, {
      idempotencyKey
    })
    
    console.log(`[billing/checkout] Created session ${session.id} for user ${user.id}, plan ${priceId}`)
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id
    })
    
  } catch (error) {
    console.error('[billing/checkout] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
