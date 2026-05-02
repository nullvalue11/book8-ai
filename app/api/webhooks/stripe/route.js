import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { env } from '@/lib/env'
import { getCallMinutesItemId, extractSubscriptionBillingFields } from '@/lib/stripeSubscription'
import { updateSubscriptionFields, updateSubscriptionByCustomerId } from '@/lib/subscriptionUpdate'
import {
  COLLECTION_NAME as BUSINESS_COLLECTION,
  SUBSCRIPTION_STATUS,
  stripeStatusToBusinessSubscriptionStatus
} from '@/lib/schemas/business'
import {
  sendTrialStartedEmail,
  sendTrialEndingEmail,
  sendTrialConvertedEmail,
  sendPaymentFailedEmail
} from '@/lib/trialLifecycleEmail'
import { sendEndOfAccessEmail } from '@/lib/cancellationEmail'
import { provisionOnCoreApi } from '@/lib/provision-business'
import { syncPlanToCore } from '@/lib/sync-calendar-to-core'
import { syncSubscriptionWithDeadLetter } from '@/lib/syncSubscriptionToCoreApi'
import { ensureSyncFailureIndexes } from '@/models/SyncFailure'

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
      await db
        .collection('provisioningAlerts')
        .createIndex({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })
      await db.collection('provisioningAlerts').createIndex({ businessId: 1, resolved: 1 })
      await ensureSyncFailureIndexes(db.collection('sync_failures'))
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
    case 'customer.subscription.trial_will_end':
      subscriptionId = obj.id || null
      customerId = obj.customer || null
      plan = obj?.items?.data?.[0]?.price?.id || null
      status = obj.status || 'trialing'
      break
    default:
      // keep best-effort fields
      break
  }

  return { type, customerId, subscriptionId, plan, status }
}

function planFromStripePriceId(priceId) {
  if (!priceId || !env?.STRIPE) return null
  if (priceId === env.STRIPE?.PRICE_ENTERPRISE) return 'enterprise'
  if (priceId === env.STRIPE?.PRICE_GROWTH) return 'growth'
  if (priceId === env.STRIPE?.PRICE_STARTER) return 'starter'
  return null
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
      const plan = planFromStripePriceId(billingFields.stripePriceId) || 'starter'
      
      // Update user's subscription record (using atomic update to handle subscription: null)
      await updateSubscriptionFields(database.collection('users'), userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeCallMinutesItemId: billingFields.stripeCallMinutesItemId,
        stripePriceId: billingFields.stripePriceId,
        plan,
        status: subscription.status,
        currentPeriodStart: billingFields.currentPeriodStart,
        currentPeriodEnd: billingFields.currentPeriodEnd,
        trialStart: billingFields.trialStart,
        trialEnd: billingFields.trialEnd,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`[webhooks/stripe] checkout.session.completed: Updated user ${userId} with subscription ${subscriptionId}, callMinutesItemId: ${billingFields.stripeCallMinutesItemId}`)
      
      // Also update business entity if businessId is in session or subscription metadata.
      // Session metadata is primary; subscription.metadata is fallback (e.g. setup sent bid in URL only).
      const rawBusinessId =
        obj.metadata?.businessId || subscription.metadata?.businessId || null
      let resolvedBizId = rawBusinessId
      if (rawBusinessId) {
        const bizDoc = await database.collection(BUSINESS_COLLECTION).findOne({
          $or: [{ businessId: rawBusinessId }, { id: rawBusinessId }]
        })
        if (bizDoc) resolvedBizId = bizDoc.businessId || bizDoc.id
      }
      if (resolvedBizId) {
        console.log('[stripe-webhook] Updating business subscription:', {
          businessId: resolvedBizId,
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId
        })

        const bizSubStatus = stripeStatusToBusinessSubscriptionStatus(subscription.status)
        const updateResult = await database.collection(BUSINESS_COLLECTION).updateOne(
          { $or: [{ businessId: resolvedBizId }, { id: resolvedBizId }] },
          {
            $set: {
              'subscription.status': bizSubStatus,
              'subscription.stripeCustomerId': customerId,
              'subscription.stripeSubscriptionId': subscriptionId,
              'subscription.stripePriceId': billingFields.stripePriceId,
              'subscription.plan': plan,
              plan,
              'subscription.currentPeriodStart': billingFields.currentPeriodStart,
              'subscription.currentPeriodEnd': billingFields.currentPeriodEnd,
              'subscription.trialStart': billingFields.trialStart,
              'subscription.trialEnd': billingFields.trialEnd,
              'subscription.activatedAt': new Date().toISOString(),
              'subscription.updatedAt': new Date(),
              'features.billingEnabled': true,
              updatedAt: new Date()
            }
          }
        )

        console.log('[stripe-webhook] Business update result:', {
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount
        })
        console.log(
          `[webhooks/stripe] checkout.session.completed: Updated business ${resolvedBizId} subscription to ${bizSubStatus}`
        )
        await syncPlanToCore({ businessId: resolvedBizId, plan }).catch((e) =>
          console.warn('[webhooks/stripe] syncPlanToCore:', e?.message || e)
        )
      }

      let businessIdForCoreSync = resolvedBizId
      if (!businessIdForCoreSync) {
        const raw =
          obj.metadata?.businessId ||
          obj.client_reference_id ||
          subscription.metadata?.businessId ||
          null
        if (raw) {
          const bizDoc = await database.collection(BUSINESS_COLLECTION).findOne({
            $or: [{ businessId: raw }, { id: raw }]
          })
          businessIdForCoreSync = bizDoc ? bizDoc.businessId || bizDoc.id : raw
        }
      }
      if (businessIdForCoreSync && subscriptionId) {
        await syncSubscriptionWithDeadLetter(database, {
          businessId: businessIdForCoreSync,
          subscriptionStatus: subscription.status,
          stripeSubscriptionId:
            typeof subscriptionId === 'string' ? subscriptionId : String(subscriptionId),
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          source: event.type
        })
      }

      // Trial started email (Growth checkout with trial)
      let owner = null
      try {
        owner = await database.collection('users').findOne({ id: userId })
      } catch (ownerLookupErr) {
        console.warn(
          '[webhooks/stripe] [EMAIL-RUNTIME-CHECK] owner lookup failed',
          ownerLookupErr?.message || ownerLookupErr
        )
      }
      console.log(
        '[EMAIL-RUNTIME-CHECK]',
        JSON.stringify({
          hasResendKey: !!env.RESEND_API_KEY,
          hasResendFrom: !!env.EMAIL_FROM,
          ownerEmail: owner?.email || null,
          trialEnd: billingFields.trialEnd || null,
          subStatus: subscription.status,
          resolvedBizId: resolvedBizId ?? null
        })
      )
      if (subscription.status === 'trialing' && billingFields.trialEnd) {
        try {
          const bizForEmail = resolvedBizId
            ? await database.collection(BUSINESS_COLLECTION).findOne({
                $or: [{ businessId: resolvedBizId }, { id: resolvedBizId }]
              })
            : null
          const trialEndFormatted = new Date(billingFields.trialEnd).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })
          if (owner?.email) {
            await sendTrialStartedEmail({
              to: owner.email,
              businessName: bizForEmail?.name || obj.customer_details?.name || 'your business',
              trialEndDate: trialEndFormatted,
              phoneNumber: bizForEmail?.phone || bizForEmail?.assignedTwilioNumber || null,
              handle: bizForEmail?.handle || null,
              calendarProvider: bizForEmail?.calendar?.provider || null
            })
          }
        } catch (emailErr) {
          console.error('[webhooks/stripe] trial started email failed:', emailErr?.message || emailErr)
        }
      }

      // ── TENANT PROVISIONING ──────────────────────────────────
      // After successful checkout, provision the tenant in core-api
      // so they're immediately bookable by phone.
      // This is idempotent — safe if Stripe sends duplicate webhooks.
      // ──────────────────────────────────────────────────────────
      try {
        const session = event.data.object

        let provisionBusinessId = session.metadata?.businessId || null
        let businessName = session.metadata?.businessName || null
        let businessEmail =
          session.metadata?.ownerEmail ||
          session.customer_email ||
          session.customer_details?.email ||
          null
        let businessTimezone = session.metadata?.timezone || 'America/Toronto'
        let businessCategory = session.metadata?.category || null
        let businessCustomCategory = session.metadata?.customCategory || null
        let businessPrimaryLanguage = null
        let businessMultilingualEnabled = undefined

        // Resolve business from DB — use actual businessId (biz_xxx) and name.
        // Handles legacy sessions with wrong metadata (slug/handle instead of biz_xxx).
        if (provisionBusinessId) {
          const biz = await database.collection(BUSINESS_COLLECTION).findOne({
            $or: [
              { businessId: provisionBusinessId },
              { id: provisionBusinessId }
            ]
          })
          if (biz) {
            provisionBusinessId = biz.businessId || biz.id
            businessName = businessName || biz.name || null
            businessEmail = businessEmail || biz.ownerEmail || null
            businessTimezone = biz.timezone || businessTimezone
            businessCategory = businessCategory || biz.category || null
          } else if (!businessName) {
            // Fallback: customer_details.name is the checkout form — often wrong for business name
            businessName = session.customer_details?.name || null
          }
        }

        const lineItems = session.line_items?.data || []
        const priceId = lineItems[0]?.price?.id || session.metadata?.priceId || null
        const provisionPlan = planFromStripePriceId(priceId) || session.metadata?.plan || 'starter'

        if (provisionBusinessId && businessName) {
          const provisionResult = await provisionOnCoreApi({
            businessId: provisionBusinessId,
            name: businessName,
            plan: provisionPlan,
            timezone: businessTimezone,
            category: businessCategory,
            customCategory: businessCustomCategory,
            primaryLanguage: businessPrimaryLanguage || undefined,
            multilingualEnabled:
              businessMultilingualEnabled !== undefined
                ? !!businessMultilingualEnabled
                : undefined,
            email: businessEmail,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null
          })

          if (provisionResult?.ok) {
            console.log('[stripe-webhook] Tenant provisioned:', {
              businessId: provisionResult.businessId,
              created: provisionResult.created,
              defaultsEnsured: provisionResult.defaultsEnsured
            })

            const coreSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET
            const coreBase = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(
              /\/$/,
              ''
            )
            if (coreSecret && provisionBusinessId) {
              try {
                await new Promise((r) => setTimeout(r, 3000))
                const hcController = new AbortController()
                const hcT = setTimeout(() => hcController.abort(), 10000)
                const healthRes = await fetch(
                  `${coreBase}/api/health/business/${encodeURIComponent(provisionBusinessId)}`,
                  {
                    headers: {
                      'x-book8-internal-secret': coreSecret,
                      'x-internal-secret': coreSecret
                    },
                    signal: hcController.signal
                  }
                )
                clearTimeout(hcT)

                if (healthRes.ok) {
                  const health = await healthRes.json().catch(() => ({}))
                  if (health.status === 'NOT_FOUND' || health.ok === false) {
                    console.error(
                      `[PROVISIONING ALERT] Business ${provisionBusinessId} failed health check after provisioning:`,
                      health
                    )
                    await database.collection('provisioningAlerts').insertOne({
                      businessId: provisionBusinessId,
                      timestamp: new Date(),
                      status: health.status || 'UNKNOWN',
                      checks: health.checks || null,
                      resolved: false
                    })
                  } else {
                    console.log(
                      `[stripe-webhook] Post-provision health OK for ${provisionBusinessId}:`,
                      health.status
                    )
                  }
                }
              } catch (healthErr) {
                console.error(
                  `[stripe-webhook] Post-provision health check error for ${provisionBusinessId}:`,
                  healthErr?.message || healthErr
                )
              }
            }
          } else if (provisionResult !== null) {
            console.error('[stripe-webhook] Tenant provisioning failed:', {
              error: provisionResult?.error || 'Unknown error',
              businessId: provisionBusinessId
            })
          }
        } else {
          console.warn('[stripe-webhook] Skipping provisioning — missing businessId or name:', {
            hasBusinessId: !!provisionBusinessId,
            hasBusinessName: !!businessName,
            sessionId: session.id
          })
        }
      } catch (provisionError) {
        console.error('[stripe-webhook] Error during tenant provisioning:', provisionError)
      }
      
      return
    }

    if (type === 'customer.subscription.trial_will_end') {
      try {
        const subscription = obj
        const rawBizId = subscription.metadata?.businessId
        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null
        let business = null
        if (rawBizId) {
          business = await database.collection(BUSINESS_COLLECTION).findOne({
            $or: [{ businessId: rawBizId }, { id: rawBizId }]
          })
        }
        if (!business && subscription.customer) {
          business = await database.collection(BUSINESS_COLLECTION).findOne({
            'subscription.stripeCustomerId': subscription.customer
          })
        }
        const ownerId = business?.ownerUserId
        const owner = ownerId
          ? await database.collection('users').findOne({ id: ownerId })
          : await database.collection('users').findOne({
              'subscription.stripeCustomerId': subscription.customer
            })
        if (owner?.email && trialEnd) {
          const trialEndFormatted = trialEnd.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })
          await sendTrialEndingEmail({
            to: owner.email,
            businessName: business?.name || owner.name || 'your business',
            trialEndDate: trialEndFormatted
          })
        }
      } catch (e) {
        console.error('[webhooks/stripe] trial_will_end email failed:', e?.message || e)
      }
      return
    }

    if (type === 'invoice.payment_failed') {
      try {
        const invoice = obj
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) return
        const user = await database.collection('users').findOne({
          'subscription.stripeCustomerId': customerId
        })
        if (user?.email) {
          await sendPaymentFailedEmail({
            to: user.email,
            businessName: user.name || 'your business'
          })
        }
      } catch (e) {
        console.error('[webhooks/stripe] payment_failed email failed:', e?.message || e)
      }
      return
    }

    if (type === 'invoice.payment_succeeded') {
      try {
        const invoice = obj
        if (!invoice.amount_paid || invoice.amount_paid <= 0) return
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        if (!customerId) return
        const user = await database.collection('users').findOne({
          'subscription.stripeCustomerId': customerId
        })
        if (!user?.email || user.subscription?.trialConvertedEmailSent) return
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id || null
        if (!subId) return
        const stripeSub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] })
        if (!stripeSub.trial_end) return
        if (stripeSub.status !== 'active') return
        const bf = extractSubscriptionBillingFields(stripeSub)
        const plan = planFromStripePriceId(bf.stripePriceId)
        if (plan !== 'growth') return
        await sendTrialConvertedEmail({
          to: user.email,
          businessName: user.name || 'your business'
        })
        await updateSubscriptionFields(database.collection('users'), user.id, {
          trialConvertedEmailSent: true,
          updatedAt: new Date().toISOString()
        })
      } catch (e) {
        console.error('[webhooks/stripe] payment_succeeded trial-converted email failed:', e?.message || e)
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
      
      // Always retrieve with expanded items so Basil-era API has item-level
      // current_period_* and price ids for extractSubscriptionBillingFields.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price']
      })
      
      // Extract billing fields
      const billingFields = extractSubscriptionBillingFields(subscription)
      const plan = planFromStripePriceId(billingFields.stripePriceId) || 'starter'
      
      // Update user's subscription record (using atomic update)
      await updateSubscriptionFields(database.collection('users'), user.id, {
        stripeSubscriptionId: subscriptionId,
        stripeCallMinutesItemId: billingFields.stripeCallMinutesItemId,
        stripePriceId: billingFields.stripePriceId,
        plan,
        status: subscription.status,
        currentPeriodStart: billingFields.currentPeriodStart,
        currentPeriodEnd: billingFields.currentPeriodEnd,
        trialStart: billingFields.trialStart,
        trialEnd: billingFields.trialEnd,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`[webhooks/stripe] ${type}: Updated user ${user.id} with subscription ${subscriptionId}, callMinutesItemId: ${billingFields.stripeCallMinutesItemId}`)
      
      // Also update any business linked to this customer.
      // BOO-CANCEL-1B: mirror cancel_at_period_end flag from Stripe to Mongo so the dashboard reflects
      // pending cancellations even when they are toggled outside our /api/billing/cancel endpoint
      // (e.g. Stripe Customer Portal). Idempotent — just a $set on a boolean.
      const mappedStatus = stripeStatusToBusinessSubscriptionStatus(subscription.status)
      const cancelAtPeriodEnd = subscription.cancel_at_period_end === true

      // BOO-CANCEL-1C: First-time link when subscription.metadata.businessId is set but the
      // business row has no subscription.stripeCustomerId yet (updateMany below would match 0).
      const rawMetaBizLink = subscription.metadata?.businessId
      if (rawMetaBizLink) {
        let bidLink = rawMetaBizLink
        const bizDocLink = await database.collection(BUSINESS_COLLECTION).findOne({
          $or: [{ businessId: rawMetaBizLink }, { id: rawMetaBizLink }]
        })
        if (bizDocLink) bidLink = bizDocLink.businessId || bizDocLink.id
        if (bidLink) {
          await database.collection(BUSINESS_COLLECTION).updateOne(
            { $or: [{ businessId: bidLink }, { id: bidLink }] },
            {
              $set: {
                'subscription.status': mappedStatus,
                'subscription.stripeCustomerId': customerId,
                'subscription.stripeSubscriptionId': subscriptionId,
                'subscription.stripePriceId': billingFields.stripePriceId,
                'subscription.plan': plan,
                plan,
                'subscription.currentPeriodStart': billingFields.currentPeriodStart,
                'subscription.currentPeriodEnd': billingFields.currentPeriodEnd,
                'subscription.trialStart': billingFields.trialStart,
                'subscription.trialEnd': billingFields.trialEnd,
                'subscription.cancelAtPeriodEnd': cancelAtPeriodEnd,
                'subscription.updatedAt': new Date(),
                'features.billingEnabled': true,
                updatedAt: new Date()
              }
            }
          )
        }
      }

      await database.collection(BUSINESS_COLLECTION).updateMany(
        { 'subscription.stripeCustomerId': customerId },
        {
          $set: {
            'subscription.status': mappedStatus,
            'subscription.stripeSubscriptionId': subscriptionId,
            'subscription.stripePriceId': billingFields.stripePriceId,
            'subscription.plan': plan,
            plan,
            'subscription.currentPeriodStart': billingFields.currentPeriodStart,
            'subscription.currentPeriodEnd': billingFields.currentPeriodEnd,
            'subscription.trialStart': billingFields.trialStart,
            'subscription.trialEnd': billingFields.trialEnd,
            'subscription.cancelAtPeriodEnd': cancelAtPeriodEnd,
            updatedAt: new Date()
          }
        }
      )

      const bizRows = await database
        .collection(BUSINESS_COLLECTION)
        .find({ 'subscription.stripeCustomerId': customerId })
        .project({ businessId: 1, id: 1 })
        .toArray()
      for (const row of bizRows) {
        const bid = row.businessId || row.id
        if (bid) {
          await syncPlanToCore({ businessId: bid, plan }).catch((e) =>
            console.warn('[webhooks/stripe] syncPlanToCore:', e?.message || e)
          )
        }
      }

      const syncIds = new Set()
      const rawMetaBiz = subscription.metadata?.businessId
      if (rawMetaBiz) {
        let bid = rawMetaBiz
        const bizDoc = await database.collection(BUSINESS_COLLECTION).findOne({
          $or: [{ businessId: rawMetaBiz }, { id: rawMetaBiz }]
        })
        if (bizDoc) bid = bizDoc.businessId || bizDoc.id
        if (bid) syncIds.add(bid)
      }
      for (const row of bizRows) {
        const bid = row.businessId || row.id
        if (bid) syncIds.add(bid)
      }
      for (const bid of syncIds) {
        await syncSubscriptionWithDeadLetter(database, {
          businessId: bid,
          subscriptionStatus: subscription.status,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          source: event.type
        })
      }

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
        // Continue — there may still be a business linked to this customer.
      } else {
        await database.collection('users').updateOne(
          { id: user.id },
          {
            $set: {
              'subscription.status': 'canceled',
              'subscription.canceledAt': new Date().toISOString(),
              'subscription.updatedAt': new Date().toISOString(),
              // Keep history, but remove plan display so UI doesn't show stale tiers.
              'subscription.plan': null,
              // Also remove business plan display if present.
              'subscription.planTier': null
            }
          }
        )

        console.log(
          `[webhooks/stripe] ${type}: Marked subscription as canceled for user ${user.id}`
        )
      }

      // BOO-CANCEL-1B: idempotent soft-delete of any business attached to this customer.
      // Gate end-of-access email + business_soft_deleted audit on softDeletedAt so Stripe replays
      // do not double-send; Path A may set canceledAt before this webhook without softDeletedAt yet.
      const businessesForDelete = await database
        .collection(BUSINESS_COLLECTION)
        .find({ 'subscription.stripeCustomerId': customerId })
        .toArray()

      const nowIso = new Date().toISOString()
      for (const biz of businessesForDelete) {
        const bid = biz.businessId || biz.id
        const wasAlreadyCanceled = !!biz?.subscription?.canceledAt
        const wasAlreadySoftDeleted = !!biz?.softDeletedAt

        const setFields = {
          'subscription.status': SUBSCRIPTION_STATUS.CANCELED,
          'features.billingEnabled': false,
          'subscription.plan': null,
          'subscription.cancelAtPeriodEnd': false,
          plan: null,
          updatedAt: new Date()
        }
        // Only stamp canceledAt the FIRST time we see a deletion.
        if (!wasAlreadyCanceled) {
          setFields['subscription.canceledAt'] = nowIso
        }
        if (!wasAlreadySoftDeleted) {
          setFields.softDeletedAt = nowIso
        }

        await database.collection(BUSINESS_COLLECTION).updateOne(
          { $or: [{ businessId: bid }, { id: bid }] },
          { $set: setFields }
        )

        if (!wasAlreadySoftDeleted) {
          try {
            await database.collection('billing_audit_logs').insertOne({
              event: 'business_soft_deleted',
              businessId: bid,
              stripeSubscriptionId: obj.id || null,
              stripeCustomerId: customerId,
              stripeEventId: event.id,
              source: type,
              createdAt: new Date()
            })
          } catch (auditErr) {
            console.error(
              '[webhooks/stripe] business_soft_deleted audit log failed:',
              auditErr?.message || auditErr
            )
          }

          // End-of-access email — only on first soft-delete stamp (not on Stripe webhook replays).
          try {
            const ownerEmail = user?.email || biz?.ownerEmail || null
            if (ownerEmail) {
              await sendEndOfAccessEmail({
                to: ownerEmail,
                businessName: biz?.name || user?.name || 'your business'
              })
            }
          } catch (emailErr) {
            console.error(
              '[webhooks/stripe] end-of-access email failed:',
              emailErr?.message || emailErr
            )
          }
        } else {
          console.log(
            `[webhooks/stripe] ${type}: business ${bid} already soft-deleted — skipping email + audit (idempotent replay)`
          )
        }
      }

      // No businesses linked? Still write a fallback users-level update for legacy data.
      if (businessesForDelete.length === 0) {
        await database.collection(BUSINESS_COLLECTION).updateMany(
          { 'subscription.stripeCustomerId': customerId },
          {
            $set: {
              'subscription.status': SUBSCRIPTION_STATUS.CANCELED,
              'subscription.canceledAt': nowIso,
              'features.billingEnabled': false,
              'subscription.plan': null,
              plan: null,
              updatedAt: new Date()
            }
          }
        )
      }

      const deletedBizRows = businessesForDelete.map((b) => ({
        businessId: b.businessId,
        id: b.id
      }))
      const subIdDeleted = obj.id
      const syncDel = new Set()
      const rawDelMeta = obj.metadata?.businessId
      if (rawDelMeta) {
        let bid = rawDelMeta
        const bizDoc = await database.collection(BUSINESS_COLLECTION).findOne({
          $or: [{ businessId: rawDelMeta }, { id: rawDelMeta }]
        })
        if (bizDoc) bid = bizDoc.businessId || bizDoc.id
        if (bid) syncDel.add(bid)
      }
      for (const row of deletedBizRows) {
        const bid = row.businessId || row.id
        if (bid) syncDel.add(bid)
      }
      for (const bid of syncDel) {
        await syncSubscriptionWithDeadLetter(database, {
          businessId: bid,
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: subIdDeleted,
          stripeCustomerId: customerId,
          stripeEventId: event.id,
          source: event.type
        })
      }

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
