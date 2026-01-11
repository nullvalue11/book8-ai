import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/lib/env'
import { getCallMinutesItemId, extractSubscriptionBillingFields } from '@/lib/stripeSubscription'
import { updateSubscriptionFields, updateSubscriptionByCustomerId } from '@/lib/subscriptionUpdate'
import { COLLECTION_NAME as BUSINESS_COLLECTION, SUBSCRIPTION_STATUS } from '@/lib/schemas/business'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db
let indexesEnsured = false

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  if (!indexesEnsured) {
    try {
      await db.collection('billing_logs').createIndex({ eventId: 1 }, { unique: true })
      await db.collection('billing_logs').createIndex({ customerId: 1, createdAt: -1 })
    } catch {}
    indexesEnsured = true
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
    console.error('[webhooks/stripe] failed to load stripe', e)
    return null
  }
}

function extractBillingFields(event) {
  const type = event.type
  const obj = event.data?.object || {}
  let customerId = obj.customer || null
  let subscriptionId = null
  let plan = null
  let status = null

  switch (type) {
    case 'checkout.session.completed':
      subscriptionId = obj.subscription || null
      customerId = obj.customer || null
      plan = obj?.display_items?.[0]?.plan?.id || obj?.subscription_details?.metadata?.price_id || obj?.metadata?.price_id || null
      status = obj.status || 'completed'
      break
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      subscriptionId = obj.id || null
      customerId = obj.customer || null
      plan = obj?.items?.data?.[0]?.price?.id || null
      status = obj.status || (type.endsWith('deleted') ? 'canceled' : null)
      break
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded':
      subscriptionId = obj.subscription || null
      customerId = obj.customer || null
      plan = obj?.lines?.data?.[0]?.price?.id || null
      status = obj.status || (type === 'invoice.payment_failed' ? 'failed' : 'paid')
      break
    default:
      // keep best-effort fields
      break
  }

  return { type, customerId, subscriptionId, plan, status }
}

/**
 * Handle subscription-related events
 * Updates the user's subscription record with billing fields including stripeCallMinutesItemId
 */
async function handleSubscriptionEvent(event, stripe, database) {
  const type = event.type
  const obj = event.data?.object || {}
  
  try {
    // Handle checkout.session.completed
    if (type === 'checkout.session.completed' && obj.subscription) {
      const subscriptionId = obj.subscription
      const customerId = obj.customer
      const userId = obj.metadata?.userId
      
      if (!userId) {
        console.log('[webhooks/stripe] checkout.session.completed missing userId in metadata')
        return
      }
      
      // Retrieve the full subscription to get items
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      })
      
      // Extract billing fields including call minutes item ID
      const billingFields = extractSubscriptionBillingFields(subscription)
      
      // Update user's subscription record (using atomic update to handle subscription: null)
      await updateSubscriptionFields(database.collection('users'), userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeCallMinutesItemId: billingFields.stripeCallMinutesItemId,
        stripePriceId: billingFields.stripePriceId,
        status: subscription.status,
        currentPeriodStart: billingFields.currentPeriodStart,
        currentPeriodEnd: billingFields.currentPeriodEnd,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`[webhooks/stripe] checkout.session.completed: Updated user ${userId} with subscription ${subscriptionId}, callMinutesItemId: ${billingFields.stripeCallMinutesItemId}`)
      
      // Also update business entity if businessId is in metadata
      const businessId = obj.metadata?.businessId
      if (businessId) {
        await database.collection(BUSINESS_COLLECTION).updateOne(
          { businessId },
          {
            $set: {
              'subscription.status': SUBSCRIPTION_STATUS.ACTIVE,
              'subscription.stripeCustomerId': customerId,
              'subscription.stripeSubscriptionId': subscriptionId,
              'subscription.stripePriceId': billingFields.stripePriceId,
              'subscription.currentPeriodStart': billingFields.currentPeriodStart,
              'subscription.currentPeriodEnd': billingFields.currentPeriodEnd,
              'subscription.activatedAt': new Date().toISOString(),
              'features.billingEnabled': true,
              updatedAt: new Date()
            }
          }
        )
        console.log(`[webhooks/stripe] checkout.session.completed: Updated business ${businessId} subscription to active`)
      }
      
      return
    }
    
    // Handle subscription created/updated
    if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
      const subscriptionId = obj.id
      const customerId = obj.customer
      
      // Find user by customer ID
      const user = await database.collection('users').findOne({
        'subscription.stripeCustomerId': customerId
      })
      
      if (!user) {
        console.log(`[webhooks/stripe] ${type}: No user found for customer ${customerId}`)
        return
      }
      
      // Retrieve full subscription if items not expanded
      let subscription = obj
      if (!obj.items?.data?.[0]?.price) {
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price']
        })
      }
      
      // Extract billing fields
      const billingFields = extractSubscriptionBillingFields(subscription)
      
      // Update user's subscription record (using atomic update)
      await updateSubscriptionFields(database.collection('users'), user.id, {
        stripeSubscriptionId: subscriptionId,
        stripeCallMinutesItemId: billingFields.stripeCallMinutesItemId,
        stripePriceId: billingFields.stripePriceId,
        status: subscription.status,
        currentPeriodStart: billingFields.currentPeriodStart,
        currentPeriodEnd: billingFields.currentPeriodEnd,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`[webhooks/stripe] ${type}: Updated user ${user.id} with subscription ${subscriptionId}, callMinutesItemId: ${billingFields.stripeCallMinutesItemId}`)
      return
    }
    
    // Handle subscription deleted
    if (type === 'customer.subscription.deleted') {
      const customerId = obj.customer
      
      const user = await database.collection('users').findOne({
        'subscription.stripeCustomerId': customerId
      })
      
      if (!user) {
        console.log(`[webhooks/stripe] ${type}: No user found for customer ${customerId}`)
        return
      }
      
      await database.collection('users').updateOne(
        { id: user.id },
        {
          $set: {
            'subscription.status': 'canceled',
            'subscription.canceledAt': new Date().toISOString(),
            'subscription.updatedAt': new Date().toISOString()
          }
        }
      )
      
      console.log(`[webhooks/stripe] ${type}: Marked subscription as canceled for user ${user.id}`)
      return
    }
    
  } catch (error) {
    console.error(`[webhooks/stripe] Error handling ${type}:`, error.message)
    // Don't throw - we've already logged the event
  }
}

export async function POST(req) {
  try {
    const stripe = await getStripe()
    if (!stripe) return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 400 })

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')
    const secret = env.STRIPE?.WEBHOOK_SECRET
    if (!sig || !secret) {
      return NextResponse.json({ ok: false, error: 'Missing signature or webhook secret' }, { status: 400 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(body, sig, secret)
    } catch (err) {
      console.error('[webhooks/stripe] signature verification failed', err?.message)
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 })
    }

    const database = await connectToMongo()

    // Idempotency check
    const exists = await database.collection('billing_logs').findOne({ eventId: event.id })
    if (exists) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    const fields = extractBillingFields(event)

    const doc = {
      id: uuidv4(),
      eventId: event.id,
      type: fields.type,
      customerId: fields.customerId || null,
      subscriptionId: fields.subscriptionId || null,
      plan: fields.plan || null,
      status: fields.status || null,
      rawEvent: event,
      createdAt: new Date((event.created || Math.floor(Date.now()/1000)) * 1000),
      processedAt: new Date(),
    }

    try {
      await database.collection('billing_logs').insertOne(doc)
    } catch (e) {
      if (String(e?.message || '').includes('duplicate key')) {
        return NextResponse.json({ ok: true, duplicate: true })
      }
      console.error('[webhooks/stripe] insert error', e)
      return NextResponse.json({ ok: false, error: 'Insert failed' }, { status: 500 })
    }

    // Handle subscription-related events
    await handleSubscriptionEvent(event, stripe, database)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[webhooks/stripe] unexpected', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
