/**
 * Stripe Subscription Helper Functions
 * 
 * This module provides utilities for managing Stripe subscriptions
 * with metered billing for call minutes.
 * 
 * Every subscription includes:
 * 1. A base plan price (starter/growth/enterprise)
 * 2. A metered minutes price (STRIPE_PRICE_CALL_MINUTE_METERED)
 */

import { env } from '@/lib/env'

/**
 * Get the Stripe SDK instance
 * @returns {Promise<Stripe|null>}
 */
export async function getStripe() {
  try {
    const Stripe = (await import('stripe')).default
    const key = env.STRIPE?.SECRET_KEY
    if (!key) return null
    return new Stripe(key)
  } catch (e) {
    console.error('[stripe] Failed to load Stripe:', e)
    return null
  }
}

/**
 * Get the subscription item ID for call minutes from a subscription object
 * 
 * @param {object} subscription - Stripe subscription object (with items.data expanded)
 * @param {string} callMinutesPriceId - The price ID for metered call minutes
 * @returns {string|null} The subscription item ID for metered minutes, or null if not found
 */
export function getCallMinutesItemId(subscription, callMinutesPriceId) {
  if (!subscription?.items?.data || !callMinutesPriceId) {
    return null
  }
  
  const item = subscription.items.data.find(i => i.price?.id === callMinutesPriceId)
  return item?.id || null
}

/**
 * Create line items for a checkout session or subscription
 * Includes both the base plan and the metered call minutes item
 * 
 * @param {string} basePriceId - The base plan price ID
 * @returns {Array} Array of line items for Stripe
 */
export function buildSubscriptionLineItems(basePriceId) {
  const meteredPriceId = env.STRIPE?.PRICE_CALL_MINUTE_METERED
  
  const items = [
    { price: basePriceId, quantity: 1 }
  ]
  
  // Add metered minutes item if configured
  if (meteredPriceId) {
    items.push({ price: meteredPriceId })
  }
  
  return items
}

/**
 * Generate a deterministic idempotency key for subscription operations
 * 
 * @param {string} operation - The operation type (e.g., 'create', 'update')
 * @param {string} userId - The user/business ID
 * @param {string} [extra] - Optional extra data (e.g., plan name)
 * @returns {string} Idempotency key
 */
export function generateIdempotencyKey(operation, userId, extra = '') {
  const base = `sub_${operation}:${userId}`
  return extra ? `${base}:${extra}` : base
}

/**
 * Attach the metered call minutes item to an existing subscription
 * Used for backfilling existing subscriptions that don't have it
 * 
 * @param {Stripe} stripe - Stripe SDK instance
 * @param {string} subscriptionId - The subscription ID
 * @returns {Promise<{success: boolean, itemId: string|null, error: string|null}>}
 */
export async function attachMeteredItemToSubscription(stripe, subscriptionId) {
  const meteredPriceId = env.STRIPE?.PRICE_CALL_MINUTE_METERED
  
  if (!meteredPriceId) {
    return { success: false, itemId: null, error: 'STRIPE_PRICE_CALL_MINUTE_METERED not configured' }
  }
  
  try {
    // First, fetch the subscription to check if it already has the metered item
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price']
    })
    
    // Check if metered item already exists
    const existingItemId = getCallMinutesItemId(subscription, meteredPriceId)
    if (existingItemId) {
      return { success: true, itemId: existingItemId, error: null, alreadyExists: true }
    }
    
    // Add the metered item to the subscription
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        ...subscription.items.data.map(item => ({ id: item.id })), // Keep existing items
        { price: meteredPriceId } // Add metered item
      ],
      proration_behavior: 'none' // Don't prorate for metered item addition
    })
    
    // Get the new item ID
    const newItemId = getCallMinutesItemId(updatedSubscription, meteredPriceId)
    
    console.log(`[stripe] Attached metered item ${newItemId} to subscription ${subscriptionId}`)
    
    return { success: true, itemId: newItemId, error: null, alreadyExists: false }
    
  } catch (error) {
    console.error(`[stripe] Failed to attach metered item to ${subscriptionId}:`, error.message)
    return { success: false, itemId: null, error: error.message }
  }
}

/**
 * Extract and return billing-related fields from a subscription
 * 
 * @param {object} subscription - Stripe subscription object
 * @returns {object} Billing fields to store
 */
export function extractSubscriptionBillingFields(subscription) {
  const meteredPriceId = env.STRIPE?.PRICE_CALL_MINUTE_METERED
  const callMinutesItemId = getCallMinutesItemId(subscription, meteredPriceId)
  
  // Find the base plan item (first non-metered item)
  const basePlanItem = subscription.items?.data?.find(
    item => item.price?.id !== meteredPriceId
  )
  
  return {
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    stripeCallMinutesItemId: callMinutesItemId,
    stripePriceId: basePlanItem?.price?.id || null,
    status: subscription.status,
    currentPeriodStart: subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toISOString() 
      : null,
    currentPeriodEnd: subscription.current_period_end 
      ? new Date(subscription.current_period_end * 1000).toISOString() 
      : null
  }
}
