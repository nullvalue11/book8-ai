/**
 * GET /api/debug/subscription
 * 
 * Debug endpoint to check subscription status directly from database.
 * Shows raw user subscription data.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { isSubscribed, getSubscriptionDetails, getPlanTier } from '@/lib/subscription'

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

export async function GET(request) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No token' }, { status: 401 })
    }
    
    let payload
    try {
      payload = jwt.verify(token, env.JWT_SECRET)
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'Invalid token', details: e.message }, { status: 401 })
    }
    
    const database = await connect()
    const user = await database.collection('users').findOne({ id: payload.sub })
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    
    // Get raw subscription data
    const rawSubscription = user.subscription
    
    // Get computed values
    const subscribed = isSubscribed(user)
    const details = getSubscriptionDetails(user, env)
    const tier = getPlanTier(rawSubscription?.stripePriceId, env)
    
    // Check env config
    const stripeConfig = {
      hasPriceStarter: !!env.STRIPE?.PRICE_STARTER,
      hasPriceGrowth: !!env.STRIPE?.PRICE_GROWTH,
      hasPriceEnterprise: !!env.STRIPE?.PRICE_ENTERPRISE,
      priceStarter: env.STRIPE?.PRICE_STARTER?.substring(0, 20) + '...',
      priceGrowth: env.STRIPE?.PRICE_GROWTH?.substring(0, 20) + '...',
      priceEnterprise: env.STRIPE?.PRICE_ENTERPRISE?.substring(0, 20) + '...'
    }
    
    return NextResponse.json({
      ok: true,
      userId: user.id,
      email: user.email,
      rawSubscription,
      computed: {
        isSubscribed: subscribed,
        planTier: tier,
        details
      },
      stripeConfig,
      checks: {
        hasSubscriptionObject: !!rawSubscription,
        hasStripeSubscriptionId: !!rawSubscription?.stripeSubscriptionId,
        status: rawSubscription?.status,
        stripePriceId: rawSubscription?.stripePriceId,
        validStatus: ['active', 'trialing', 'past_due'].includes(rawSubscription?.status)
      }
    })
    
  } catch (error) {
    console.error('[debug/subscription] Error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
