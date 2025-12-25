/**
 * POST /api/admin/stripe/backfill-call-minutes
 * 
 * Purpose:
 * Admin endpoint to attach the metered call minutes item to all existing
 * active subscriptions that don't already have it.
 * 
 * Authentication:
 * Protected by ADMIN_TOKEN environment variable.
 * Requires header: x-admin-token: <ADMIN_TOKEN>
 * 
 * Request:
 * POST /api/admin/stripe/backfill-call-minutes
 * Headers: { "x-admin-token": "your-admin-token" }
 * 
 * Response:
 * {
 *   "ok": true,
 *   "total": 3,
 *   "updated": 2,
 *   "skipped": 1,
 *   "failed": 0,
 *   "failedIds": [],
 *   "debug": {
 *     "hasSubId": 5,
 *     "activeOrTrialingOrPastDue": 3,
 *     "hasMinutesItemId": 0,
 *     "missingMinutesItemId": 3,
 *     "selected": 3
 *   }
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { getStripe, getCallMinutesItemId } from '@/lib/stripeSubscription'

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

/**
 * Verify admin token
 */
function verifyAdminToken(request) {
  const adminToken = env.ADMIN_TOKEN
  if (!adminToken) {
    return { valid: false, error: 'ADMIN_TOKEN not configured' }
  }
  
  const providedToken = request.headers.get('x-admin-token')
  if (!providedToken) {
    return { valid: false, error: 'Missing x-admin-token header' }
  }
  
  if (providedToken !== adminToken) {
    return { valid: false, error: 'Invalid admin token' }
  }
  
  return { valid: true }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(request) {
  console.log('[admin/stripe/backfill-call-minutes] Starting backfill...')
  
  // 1. Verify admin token
  const authCheck = verifyAdminToken(request)
  if (!authCheck.valid) {
    console.log('[admin/stripe/backfill-call-minutes] Auth failed:', authCheck.error)
    return NextResponse.json(
      { ok: false, error: authCheck.error },
      { status: 401 }
    )
  }
  
  // 2. Check Stripe configuration
  const stripe = await getStripe()
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: 'Stripe not configured' },
      { status: 400 }
    )
  }
  
  const meteredPriceId = env.STRIPE?.PRICE_CALL_MINUTE_METERED
  if (!meteredPriceId) {
    return NextResponse.json(
      { ok: false, error: 'STRIPE_PRICE_CALL_MINUTE_METERED not configured' },
      { status: 400 }
    )
  }
  
  try {
    const database = await connect()
    const usersCollection = database.collection('users')
    
    // ===== DIAGNOSTIC COUNTS =====
    // Compute via separate count queries to see exactly where the filter is failing
    
    const hasSubId = await usersCollection.countDocuments({
      'subscription.stripeSubscriptionId': { $exists: true, $ne: null }
    })
    
    const activeOrTrialingOrPastDue = await usersCollection.countDocuments({
      'subscription.status': { $in: ['active', 'trialing', 'past_due'] }
    })
    
    const hasMinutesItemId = await usersCollection.countDocuments({
      'subscription.stripeCallMinutesItemId': { $exists: true, $ne: null }
    })
    
    const missingMinutesItemId = await usersCollection.countDocuments({
      'subscription.stripeSubscriptionId': { $exists: true, $ne: null },
      'subscription.status': { $in: ['active', 'trialing', 'past_due'] },
      $or: [
        { 'subscription.stripeCallMinutesItemId': { $exists: false } },
        { 'subscription.stripeCallMinutesItemId': null }
      ]
    })
    
    const debug = {
      hasSubId,
      activeOrTrialingOrPastDue,
      hasMinutesItemId,
      missingMinutesItemId,
      selected: 0 // Will update after query
    }
    
    console.log(`[admin/stripe/backfill-call-minutes] Debug counts:`, debug)
    
    // ===== SELECTION QUERY =====
    // Select users who:
    // - have subscription.stripeSubscriptionId
    // - have billable subscription status
    // - are missing subscription.stripeCallMinutesItemId
    
    const selectionQuery = {
      'subscription.stripeSubscriptionId': { $exists: true, $ne: null },
      'subscription.status': { $in: ['active', 'trialing', 'past_due'] },
      $or: [
        { 'subscription.stripeCallMinutesItemId': { $exists: false } },
        { 'subscription.stripeCallMinutesItemId': null }
      ]
    }
    
    const usersToBackfill = await usersCollection.find(selectionQuery).toArray()
    debug.selected = usersToBackfill.length
    
    console.log(`[admin/stripe/backfill-call-minutes] Found ${usersToBackfill.length} users to backfill`)
    
    // ===== RESPONSE STRUCTURE =====
    const response = {
      ok: true,
      version: 'backfill-v2',
      commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      total: usersToBackfill.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      failedIds: [],
      debug
    }
    
    // ===== PROCESS EACH USER =====
    for (const user of usersToBackfill) {
      const userId = user.id
      const subscriptionId = user.subscription?.stripeSubscriptionId
      
      if (!subscriptionId) {
        console.log(`[admin/stripe/backfill-call-minutes] User ${userId} has no subscriptionId, skipping`)
        response.skipped++
        continue
      }
      
      try {
        // ===== JOB A: Ensure the subscription has the metered price item =====
        
        // First, fetch the subscription to check if it already has the metered item
        let subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price']
        })
        
        // Check if metered item already exists in Stripe
        let itemId = getCallMinutesItemId(subscription, meteredPriceId)
        
        if (!itemId) {
          // Metered item is missing - add it to the subscription
          console.log(`[admin/stripe/backfill-call-minutes] User ${userId}: Adding metered item to subscription ${subscriptionId}`)
          
          subscription = await stripe.subscriptions.update(subscriptionId, {
            items: [
              ...subscription.items.data.map(item => ({ id: item.id })), // Keep existing items
              { price: meteredPriceId } // Add metered item
            ],
            proration_behavior: 'none' // Avoid surprise proration charges
          })
          
          // ===== JOB B: Fetch subscription again and store stripeCallMinutesItemId =====
          itemId = getCallMinutesItemId(subscription, meteredPriceId)
        }
        
        // If itemId is still null, mark as failed
        if (!itemId) {
          console.error(`[admin/stripe/backfill-call-minutes] User ${userId}: Could not get metered item ID after update`)
          response.failed++
          response.failedIds.push(userId)
          continue
        }
        
        // Persist the stripeCallMinutesItemId
        await usersCollection.updateOne(
          { id: userId },
          { 
            $set: { 
              'subscription.stripeCallMinutesItemId': itemId,
              'subscription.updatedAt': new Date().toISOString()
            } 
          }
        )
        
        console.log(`[admin/stripe/backfill-call-minutes] User ${userId}: Successfully stored item ID ${itemId}`)
        response.updated++
        
      } catch (error) {
        console.error(`[admin/stripe/backfill-call-minutes] Error for user ${userId}:`, error.message)
        response.failed++
        response.failedIds.push(userId)
      }
    }
    
    console.log('[admin/stripe/backfill-call-minutes] Backfill complete:', response)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('[admin/stripe/backfill-call-minutes] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
