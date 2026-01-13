/**
 * POST /api/subscribe
 * 
 * Flat route for business subscription - avoids dynamic segment issues.
 * businessId is passed in the request body instead of URL.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// MongoDB connection
let cachedClient = null
let cachedDb = null

async function connectToDatabase() {
  if (cachedDb) return cachedDb
  
  const client = await MongoClient.connect(env.MONGO_URL)
  cachedClient = client
  cachedDb = client.db(env.DB_NAME)
  return cachedDb
}

// Initialize Stripe lazily
async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(env.STRIPE.SECRET_KEY, {
    apiVersion: '2023-10-16'
  })
}

// GET - Health check
export async function GET() {
  console.log('[api/subscribe] GET health check')
  
  return NextResponse.json({
    ok: true,
    message: 'Subscribe endpoint active. Use POST with businessId in body.',
    stripeConfigured: !!env.STRIPE?.SECRET_KEY,
    priceConfigured: !!env.STRIPE?.PRICE_STARTER
  })
}

// POST - Create Stripe Checkout Session
export async function POST(request) {
  console.log('[api/subscribe] ========== POST REQUEST ==========')
  
  try {
    // Get businessId from request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid JSON body' 
      }, { status: 400 })
    }
    
    const { businessId } = body
    console.log('[api/subscribe] businessId:', businessId)
    
    if (!businessId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'businessId is required in request body' 
      }, { status: 400 })
    }
    
    // 1. Validate Stripe configuration
    if (!env.STRIPE?.SECRET_KEY) {
      console.error('[api/subscribe] STRIPE_SECRET_KEY not set')
      return NextResponse.json({ 
        ok: false, 
        error: 'Stripe not configured' 
      }, { status: 500 })
    }
    
    if (!env.STRIPE?.PRICE_STARTER) {
      console.error('[api/subscribe] STRIPE_PRICE_STARTER not set')
      return NextResponse.json({ 
        ok: false, 
        error: 'Stripe price not configured' 
      }, { status: 500 })
    }
    
    // 2. Authenticate user
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    
    if (!token) {
      console.log('[api/subscribe] No auth token')
      return NextResponse.json({ 
        ok: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }
    
    let userId
    try {
      const payload = jwt.verify(token, env.JWT_SECRET)
      userId = payload.sub
      console.log('[api/subscribe] Authenticated user:', userId)
    } catch (err) {
      console.log('[api/subscribe] Invalid token:', err.message)
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid or expired token' 
      }, { status: 401 })
    }
    
    // 3. Get database
    const db = await connectToDatabase()
    console.log('[api/subscribe] Database connected')
    
    // 4. Get user
    const user = await db.collection('users').findOne({ id: userId })
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'User not found' 
      }, { status: 404 })
    }
    console.log('[api/subscribe] User found:', user.email)
    
    // 5. Get business
    const business = await db.collection('businesses').findOne({ businessId })
    if (!business) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Business not found' 
      }, { status: 404 })
    }
    console.log('[api/subscribe] Business found:', business.name)
    
    // 6. Verify ownership
    if (business.ownerUserId !== userId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }
    
    // 7. Initialize Stripe
    const stripe = await getStripe()
    
    // 8. Get or create Stripe customer
    let customerId = business.subscription?.stripeCustomerId || user.subscription?.stripeCustomerId
    
    if (!customerId) {
      console.log('[api/subscribe] Creating new Stripe customer...')
      const customer = await stripe.customers.create({
        email: user.email,
        name: business.name,
        metadata: { 
          userId: user.id, 
          businessId: business.businessId 
        }
      })
      customerId = customer.id
      console.log('[api/subscribe] Created customer:', customerId)
      
      // Save customer ID
      await db.collection('businesses').updateOne(
        { businessId },
        { $set: { 'subscription.stripeCustomerId': customerId, updatedAt: new Date() } }
      )
    }
    
    // 9. Create Checkout Session
    const baseUrl = env.BASE_URL
    const priceId = env.STRIPE.PRICE_STARTER
    
    console.log('[api/subscribe] Creating checkout session...')
    console.log('[api/subscribe] Customer:', customerId)
    console.log('[api/subscribe] Price:', priceId)
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${baseUrl}/dashboard/business?checkout=success&businessId=${businessId}`,
      cancel_url: `${baseUrl}/dashboard/business?checkout=canceled&businessId=${businessId}`,
      metadata: {
        userId: user.id,
        businessId: business.businessId
      }
    })
    
    console.log('[api/subscribe] Session created:', session.id)
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      businessId
    })
    
  } catch (error) {
    console.error('[api/subscribe] ERROR:', error.message)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
