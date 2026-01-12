/**
 * GET/POST /api/business/[businessId]/subscribe
 * 
 * Simplified subscription endpoint for business checkout.
 * This is a flatter route structure to avoid nested folder issues.
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
    console.error('[business/subscribe] failed to load stripe', e)
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

// Test endpoint - GET
export async function GET(request, { params }) {
  console.log('[business/subscribe] ====== GET REQUEST RECEIVED ======')
  console.log('[business/subscribe] params:', JSON.stringify(params))
  console.log('[business/subscribe] URL:', request.url)
  console.log('[business/subscribe] Method:', request.method)
  console.log('[business/subscribe] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())))
  
  return NextResponse.json({
    ok: true,
    message: 'Subscribe endpoint is working - use POST to create checkout',
    businessId: params.businessId,
    method: 'GET',
    timestamp: new Date().toISOString(),
    hint: 'If you see this in production, your POST request was converted to GET'
  })
}

// Main subscription endpoint - POST
export async function POST(request, { params }) {
  console.log('[business/subscribe] ====== POST REQUEST RECEIVED ======')
  console.log('[business/subscribe] params:', JSON.stringify(params))
  console.log('[business/subscribe] URL:', request.url)
  console.log('[business/subscribe] Method:', request.method)
  console.log('[business/subscribe] Headers:', JSON.stringify(Object.fromEntries(request.headers.entries())))
  
  try {
    const { businessId } = params
    console.log('[business/subscribe] businessId:', businessId)
    
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }
    
    // Check Stripe
    if (!env.STRIPE?.SECRET_KEY) {
      console.error('[business/subscribe] STRIPE_SECRET_KEY not configured')
      return NextResponse.json(
        { ok: false, error: 'Stripe is not configured' },
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
    
    const database = await connect()
    const authResult = await requireAuth(request, database)
    
    if (authResult.error) {
      console.log('[business/subscribe] Auth failed:', authResult.error)
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status }
      )
    }
    
    const { user, payload } = authResult
    console.log('[business/subscribe] User:', user.id)
    
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
    
    // Get price ID - use PRICE_STARTER as default
    const basePriceId = env.STRIPE?.PRICE_STARTER
    if (!basePriceId) {
      return NextResponse.json({
        ok: false,
        error: 'No Stripe price configured (STRIPE_PRICE_STARTER missing)'
      }, { status: 500 })
    }
    console.log('[business/subscribe] Using price:', basePriceId)
    
    // Get or create customer
    let stripeCustomerId = business.subscription?.stripeCustomerId
    
    if (!stripeCustomerId) {
      if (user.subscription?.stripeCustomerId) {
        stripeCustomerId = user.subscription.stripeCustomerId
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: business.name,
          metadata: { userId: user.id, businessId: business.businessId }
        })
        stripeCustomerId = customer.id
      }
      
      await database.collection(COLLECTION_NAME).updateOne(
        { businessId },
        { $set: { 'subscription.stripeCustomerId': stripeCustomerId, updatedAt: new Date() } }
      )
    }
    
    // Create session
    const baseUrl = env.BASE_URL || 'http://localhost:3000'
    
    console.log('[business/subscribe] Creating Stripe session...')
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: basePriceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/business?checkout=success&businessId=${businessId}`,
      cancel_url: `${baseUrl}/dashboard/business?checkout=canceled&businessId=${businessId}`,
      metadata: { userId: user.id, businessId: business.businessId }
    })
    
    console.log('[business/subscribe] Session created:', session.id)
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      businessId
    })
    
  } catch (error) {
    console.error('[business/subscribe] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
