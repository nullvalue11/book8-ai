/**
 * POST /api/business/[businessId]/subscribe
 * 
 * Creates a Stripe Checkout session for business subscription.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
export async function GET(request, { params }) {
  const { businessId } = params
  
  console.log('[subscribe] GET request for businessId:', businessId)
  
  return NextResponse.json({
    ok: true,
    message: 'Subscribe endpoint active. Use POST to create checkout session.',
    businessId,
    stripeConfigured: !!env.STRIPE?.SECRET_KEY,
    priceConfigured: !!env.STRIPE?.PRICE_STARTER
  })
}

// POST - Create Stripe Checkout Session
export async function POST(request, { params }) {
  console.log('[subscribe] ========== POST REQUEST ==========')
  console.log('[subscribe] businessId:', params.businessId)
  
  try {
    const { businessId } = params
    
    // 1. Validate Stripe configuration
    if (!env.STRIPE?.SECRET_KEY) {
      console.error('[subscribe] STRIPE_SECRET_KEY not set')
      return NextResponse.json({ 
        ok: false, 
        error: 'Stripe not configured (missing STRIPE_SECRET_KEY)' 
      }, { status: 500 })
    }
    
    if (!env.STRIPE?.PRICE_STARTER) {
      console.error('[subscribe] STRIPE_PRICE_STARTER not set')
      return NextResponse.json({ 
        ok: false, 
        error: 'Stripe price not configured (missing STRIPE_PRICE_STARTER)' 
      }, { status: 500 })
    }
    
    // 2. Authenticate user
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    
    if (!token) {
      console.log('[subscribe] No auth token')
      return NextResponse.json({ 
        ok: false, 
        error: 'Authentication required' 
      }, { status: 401 })
    }
    
    let userId
    try {
      const payload = jwt.verify(token, env.JWT_SECRET)
      userId = payload.sub
      console.log('[subscribe] Authenticated user:', userId)
    } catch (err) {
      console.log('[subscribe] Invalid token:', err.message)
      return NextResponse.json({ 
        ok: false, 
        error: 'Invalid or expired token' 
      }, { status: 401 })
    }
    
    // 3. Get database
    const db = await connectToDatabase()
    console.log('[subscribe] Database connected')
    
    // 4. Get user
    const user = await db.collection('users').findOne({ id: userId })
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: 'User not found' 
      }, { status: 404 })
    }
    console.log('[subscribe] User found:', user.email)
    
    // 5. Get business
    const business = await db.collection('businesses').findOne({ businessId })
    if (!business) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Business not found' 
      }, { status: 404 })
    }
    console.log('[subscribe] Business found:', business.name)
    
    // 6. Verify ownership
    if (business.ownerUserId !== userId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Access denied - not business owner' 
      }, { status: 403 })
    }
    
    // 7. Initialize Stripe
    const stripe = await getStripe()
    
    // 8. Get or create Stripe customer
    let customerId = business.subscription?.stripeCustomerId || user.subscription?.stripeCustomerId
    
    if (!customerId) {
      console.log('[subscribe] Creating new Stripe customer...')
      const customer = await stripe.customers.create({
        email: user.email,
        name: business.name,
        metadata: { 
          userId: user.id, 
          businessId: business.businessId 
        }
      })
      customerId = customer.id
      console.log('[subscribe] Created customer:', customerId)
      
      // Save customer ID
      await db.collection('businesses').updateOne(
        { businessId },
        { $set: { 'subscription.stripeCustomerId': customerId, updatedAt: new Date() } }
      )
    }
    
    // 9. Create Checkout Session
    const baseUrl = env.BASE_URL
    const priceId = env.STRIPE.PRICE_STARTER
    
    console.log('[subscribe] Creating checkout session...')
    console.log('[subscribe] Customer:', customerId)
    console.log('[subscribe] Price:', priceId)
    console.log('[subscribe] BaseURL:', baseUrl)
    
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
        businessId: business.businessId,
        businessName: business.name
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          businessId: business.businessId
        }
      }
    })
    
    console.log('[subscribe] Session created:', session.id)
    console.log('[subscribe] Checkout URL:', session.url)
    
    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      businessId
    })
    
  } catch (error) {
    console.error('[subscribe] ERROR:', error.message)
    console.error('[subscribe] Stack:', error.stack)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error',
      code: error.code || 'UNKNOWN'
    }, { status: 500 })
  }
}
