/**
 * Subscription Guard - Reusable middleware for protecting paid features
 * 
 * Usage in API routes:
 * 
 * import { requireActiveSubscription } from '@/lib/subscriptionGuard'
 * 
 * export async function POST(request) {
 *   const guard = await requireActiveSubscription(request, 'calendar')
 *   if (guard.error) return guard.response
 *   
 *   const { user, db } = guard
 *   // ... rest of handler
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'

let client, db

async function getDb() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

/**
 * Authenticate user from request
 * @param {Request} request - The incoming request
 * @returns {Promise<{user: object|null, error: string|null, status: number}>}
 */
async function authenticateUser(request) {
  const database = await getDb()
  
  // Try Bearer token first
  const auth = request.headers.get('authorization') || ''
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  
  // Try query param (for redirects like Google OAuth)
  if (!token) {
    try {
      const url = new URL(request.url)
      token = url.searchParams.get('jwt') || url.searchParams.get('token')
    } catch {}
  }
  
  if (!token) {
    return { user: null, error: 'Missing Authorization header', status: 401 }
  }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    
    if (!user) {
      return { user: null, error: 'User not found', status: 401 }
    }
    
    return { user, error: null, status: 200, db: database }
  } catch (err) {
    return { user: null, error: 'Invalid or expired token', status: 401 }
  }
}

/**
 * Create a 402 Payment Required response for API routes
 * @param {string} feature - The feature being accessed
 * @returns {NextResponse}
 */
function createSubscriptionRequiredResponse(feature) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED',
      feature: feature,
      message: `An active subscription is required to access ${feature} features. Please subscribe at /pricing`
    },
    { status: 402 }
  )
}

/**
 * Require active subscription for API routes
 * 
 * @param {Request} request - The incoming request
 * @param {string} feature - Feature name for error messages (e.g., 'calendar', 'agent', 'analytics')
 * @returns {Promise<{error: boolean, response?: NextResponse, user?: object, db?: Db}>}
 * 
 * @example
 * const guard = await requireActiveSubscription(request, 'calendar')
 * if (guard.error) return guard.response
 * const { user, db } = guard
 */
export async function requireActiveSubscription(request, feature = 'this') {
  // Step 1: Authenticate
  const auth = await authenticateUser(request)
  
  if (auth.error) {
    return {
      error: true,
      response: NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      )
    }
  }
  
  // Step 2: Check subscription
  if (!isSubscribed(auth.user)) {
    console.log(`[subscriptionGuard] User ${auth.user.id} blocked from ${feature} - no active subscription`)
    return {
      error: true,
      response: createSubscriptionRequiredResponse(feature)
    }
  }
  
  // Step 3: Return user and db for the handler
  return {
    error: false,
    user: auth.user,
    db: auth.db
  }
}

/**
 * Require authentication only (no subscription check)
 * Use for routes that need auth but not subscription (like /api/user)
 * 
 * @param {Request} request - The incoming request
 * @returns {Promise<{error: boolean, response?: NextResponse, user?: object, db?: Db}>}
 */
export async function requireAuth(request) {
  const auth = await authenticateUser(request)
  
  if (auth.error) {
    return {
      error: true,
      response: NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status }
      )
    }
  }
  
  return {
    error: false,
    user: auth.user,
    db: auth.db
  }
}

/**
 * Check if request is from a subscribed user (non-blocking)
 * Returns subscription status without blocking the request
 * 
 * @param {Request} request - The incoming request
 * @returns {Promise<{authenticated: boolean, subscribed: boolean, user?: object, db?: Db}>}
 */
export async function checkSubscriptionStatus(request) {
  const auth = await authenticateUser(request)
  
  if (auth.error) {
    return { authenticated: false, subscribed: false }
  }
  
  return {
    authenticated: true,
    subscribed: isSubscribed(auth.user),
    user: auth.user,
    db: auth.db
  }
}
