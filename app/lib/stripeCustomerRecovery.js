/**
 * Recover from stale Stripe customer IDs (e.g. test-mode cus_* stored while app uses live keys).
 */

import { updateSubscriptionFields } from '@/lib/subscriptionUpdate'

export function isStripeCustomerMissingError(error) {
  if (!error) return false
  const code = error.code
  const status = error.statusCode ?? error.raw?.statusCode
  const msg = String(error.message || '')
  return (
    code === 'resource_missing' ||
    status === 404 ||
    /no such customer/i.test(msg)
  )
}

/**
 * @param {import('stripe').default} stripe
 * @param {{ user: object, usersCollection: import('mongodb').Collection, businessId?: string }} opts
 */
export async function ensureStripeCustomerForUser(stripe, { user, usersCollection, businessId }) {
  let customerId = user.subscription?.stripeCustomerId || null
  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId)
      return customerId
    } catch (e) {
      if (!isStripeCustomerMissingError(e)) throw e
      customerId = null
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: {
      userId: user.id,
      ...(businessId && { businessId: String(businessId) })
    }
  })

  await updateSubscriptionFields(usersCollection, user.id, {
    stripeCustomerId: customer.id,
    updatedAt: new Date().toISOString()
  })

  return customer.id
}

/**
 * Resolves a valid Stripe customer for a business, reusing live IDs, repairing DB when stale.
 *
 * @param {import('stripe').default} stripe
 * @param {{
 *   business: object,
 *   user: object,
 *   businessesCollection: import('mongodb').Collection,
 *   usersCollection: import('mongodb').Collection,
 *   businessFilter: object
 * }} opts
 */
export async function ensureStripeCustomerForBusiness(stripe, {
  business,
  user,
  businessesCollection,
  usersCollection,
  businessFilter
}) {
  const candidates = []
  if (business.subscription?.stripeCustomerId) {
    candidates.push(business.subscription.stripeCustomerId)
  }
  if (user.subscription?.stripeCustomerId) {
    candidates.push(user.subscription.stripeCustomerId)
  }

  const seen = new Set()
  let anyAttemptFailedMissing = false

  for (const cid of candidates) {
    if (!cid || seen.has(cid)) continue
    seen.add(cid)
    try {
      await stripe.customers.retrieve(cid)
      if (cid !== business.subscription?.stripeCustomerId) {
        await businessesCollection.updateOne(businessFilter, {
          $set: {
            'subscription.stripeCustomerId': cid,
            updatedAt: new Date()
          }
        })
      }
      return cid
    } catch (e) {
      if (!isStripeCustomerMissingError(e)) throw e
      anyAttemptFailedMissing = true
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: business.name,
    metadata: {
      userId: user.id,
      businessId: business.businessId,
      businessName: business.name || ''
    }
  })
  const newId = customer.id

  await businessesCollection.updateOne(businessFilter, {
    $set: {
      'subscription.stripeCustomerId': newId,
      updatedAt: new Date()
    }
  })

  if (anyAttemptFailedMissing) {
    await updateSubscriptionFields(usersCollection, user.id, {
      stripeCustomerId: newId,
      updatedAt: new Date().toISOString()
    })
  }

  return newId
}
