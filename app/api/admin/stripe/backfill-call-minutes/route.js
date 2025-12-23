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
 *   "summary": {
 *     "total": 10,
 *     "updated": 5,
 *     "skipped": 3,
 *     "failed": 2,
 *     "failedIds": ["user-123", "user-456"]
 *   }
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import {
  getStripe,
  attachMeteredItemToSubscription,
  extractSubscriptionBillingFields
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
    
    // 3. Find all users with active subscriptions
    const usersWithSubscriptions = await database.collection('users').find({
      'subscription.stripeSubscriptionId': { $exists: true, $ne: null },
      'subscription.status': { $in: ['active', 'trialing', 'past_due'] }
    }).toArray()
    
    console.log(`[admin/stripe/backfill-call-minutes] Found ${usersWithSubscriptions.length} users with active subscriptions`)
    
    const summary = {
      total: usersWithSubscriptions.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      failedIds: []
    }
    
    // 4. Process each subscription
    for (const user of usersWithSubscriptions) {
      const userId = user.id
      const subscriptionId = user.subscription?.stripeSubscriptionId
      
      if (!subscriptionId) {
        summary.skipped++
        continue
      }
      
      // Check if already has call minutes item stored
      if (user.subscription?.stripeCallMinutesItemId) {
        console.log(`[admin/stripe/backfill-call-minutes] User ${userId} already has call minutes item, skipping`)
        summary.skipped++
        continue
      }
      
      try {
        // Attach metered item
        const result = await attachMeteredItemToSubscription(stripe, subscriptionId)
        
        if (!result.success) {
          console.error(`[admin/stripe/backfill-call-minutes] Failed for user ${userId}:`, result.error)
          summary.failed++
          summary.failedIds.push(userId)
          continue
        }
        
        if (result.alreadyExists) {
          // Update the stored item ID even if it already exists in Stripe
          await database.collection('users').updateOne(
            { id: userId },
            { 
              $set: { 
                'subscription.stripeCallMinutesItemId': result.itemId,
                'subscription.updatedAt': new Date().toISOString()
              } 
            }
          )
          console.log(`[admin/stripe/backfill-call-minutes] User ${userId}: item already exists, stored ID ${result.itemId}`)
          summary.skipped++
        } else {
          // New item was attached
          await database.collection('users').updateOne(
            { id: userId },
            { 
              $set: { 
                'subscription.stripeCallMinutesItemId': result.itemId,
                'subscription.updatedAt': new Date().toISOString()
              } 
            }
          )
          console.log(`[admin/stripe/backfill-call-minutes] User ${userId}: attached new item ${result.itemId}`)
          summary.updated++
        }
        
      } catch (error) {
        console.error(`[admin/stripe/backfill-call-minutes] Error for user ${userId}:`, error.message)
        summary.failed++
        summary.failedIds.push(userId)
      }
    }
    
    console.log('[admin/stripe/backfill-call-minutes] Backfill complete:', summary)
    
    return NextResponse.json({
      ok: true,
      summary
    })
    
  } catch (error) {
    console.error('[admin/stripe/backfill-call-minutes] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
