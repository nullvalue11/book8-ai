/**
 * GET /api/billing/me
 * 
 * Purpose:
 * Return the current user's subscription status with plan tier and features.
 * Used to verify subscription state for paywall enforcement.
 * 
 * Authentication:
 * Requires JWT Bearer token.
 * 
 * Response:
 * {
 *   "ok": true,
 *   "subscribed": true,
 *   "planTier": "enterprise",
 *   "planName": "Enterprise",
 *   "features": { ... },
 *   "subscription": { ... }
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { isSubscribed, getSubscriptionDetails } from '@/lib/subscription'

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

export async function GET(request) {
  try {
    const database = await connect()
    const auth = await requireAuth(request, database)
    
    if (auth.error) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      )
    }
    
    const user = auth.user
    
    // Debug logging
    console.log('[billing/me] User subscription data:', JSON.stringify(user.subscription, null, 2))
    
    const subscribed = isSubscribed(user)
    const subscription = getSubscriptionDetails(user, env)
    
    console.log('[billing/me] isSubscribed:', subscribed)
    console.log('[billing/me] planTier:', subscription.planTier)
    
    return NextResponse.json({
      ok: true,
      subscribed,
      planTier: subscription.planTier,
      planName: subscription.planName,
      features: subscription.features,
      subscription
    })
    
  } catch (error) {
    console.error('[billing/me] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
