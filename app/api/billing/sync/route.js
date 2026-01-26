/**
 * POST /api/billing/sync
 * 
 * Manually sync subscription status from Stripe.
 * Use this if webhook failed or to force refresh subscription state.
 * 
 * This endpoint:
 * 1. Gets the user's Stripe customer ID
 * 2. Fetches active subscriptions from Stripe
 * 3. Updates the database with the current subscription state
 * 4. Returns the updated subscription status
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env, debugLog } from '@/lib/env'
import { extractSubscriptionBillingFields } from '@/lib/stripeSubscription'
import { updateSubscriptionFields } from '@/lib/subscriptionUpdate'
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

async function getStripe() {
  const Stripe = (await import('stripe')).default
  return new Stripe(env.STRIPE.SECRET_KEY, { apiVersion: '2023-10-16' })
}

export async function POST(request) {
  debugLog('[billing/sync] Manual subscription sync requested')
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    
    if (!token) {
      return NextResponse.json({ ok: false, error: 'No token' }, { status: 401 })
    }
    
    let payload
    try {
      payload = jwt.verify(token, env.JWT_SECRET)
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })
    }
    
    const database = await connect()
    const user = await database.collection('users').findOne({ id: payload.sub })
    
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 })
    }
    
    debugLog('[billing/sync] User found:', user.email)
    debugLog('[billing/sync] Current subscription:', JSON.stringify(user.subscription, null, 2))
    
    const stripe = await getStripe()
    
    // Get customer ID - check both direct field and nested
    let customerId = user.subscription?.stripeCustomerId || user.stripeCustomerId
    
    // If no customer ID, try to find by email
    if (!customerId) {
      debugLog('[billing/sync] No customer ID found, searching by email...')
      const customers = await stripe.customers.list({ email: user.email, limit: 1 })
      
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
        debugLog('[billing/sync] Found customer by email:', customerId)
      } else {
        debugLog('[billing/sync] No Stripe customer found for this user')
        return NextResponse.json({
          ok: true,
          message: 'No Stripe customer found',
          subscribed: false,
          action: 'none'
        })
      }
    }
    
    debugLog('[billing/sync] Customer ID:', customerId)
    
    // Fetch subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
      expand: ['data.items.data.price']
    })
    
    debugLog('[billing/sync] Found subscriptions:', subscriptions.data.length)
    
    // Find the most recent active/trialing subscription
    const activeSubscription = subscriptions.data.find(
      sub => ['active', 'trialing', 'past_due'].includes(sub.status)
    )
    
    if (activeSubscription) {
      debugLog('[billing/sync] Active subscription found:', activeSubscription.id, 'status:', activeSubscription.status)
      
      // Extract billing fields
      const billingFields = extractSubscriptionBillingFields(activeSubscription)
      
      debugLog('[billing/sync] Billing fields:', JSON.stringify(billingFields, null, 2))
      
      // Update the database
      await updateSubscriptionFields(database.collection('users'), user.id, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: activeSubscription.id,
        stripeCallMinutesItemId: billingFields.stripeCallMinutesItemId,
        stripePriceId: billingFields.stripePriceId,
        status: activeSubscription.status,
        currentPeriodStart: billingFields.currentPeriodStart,
        currentPeriodEnd: billingFields.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      })
      
      debugLog('[billing/sync] Database updated successfully')
      
      // Fetch the updated user
      const updatedUser = await database.collection('users').findOne({ id: payload.sub })
      const subscribed = isSubscribed(updatedUser)
      const details = getSubscriptionDetails(updatedUser, env)
      
      return NextResponse.json({
        ok: true,
        message: 'Subscription synced successfully',
        subscribed,
        planTier: details.planTier,
        planName: details.planName,
        features: details.features,
        subscription: details,
        action: 'updated',
        stripeSubscriptionId: activeSubscription.id,
        stripeStatus: activeSubscription.status
      })
      
    } else {
      debugLog('[billing/sync] No active subscription found')
      
      // Clear subscription status if no active subscription
      await updateSubscriptionFields(database.collection('users'), user.id, {
        stripeCustomerId: customerId,
        status: 'canceled',
        updatedAt: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      })
      
      return NextResponse.json({
        ok: true,
        message: 'No active subscription found',
        subscribed: false,
        action: 'cleared',
        subscriptionsFound: subscriptions.data.map(s => ({
          id: s.id,
          status: s.status,
          created: new Date(s.created * 1000).toISOString()
        }))
      })
    }
    
  } catch (error) {
    console.error('[billing/sync] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

// Also allow GET for easy browser testing
export async function GET(request) {
  return POST(request)
}
