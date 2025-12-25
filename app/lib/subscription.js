/**
 * Subscription Status Helper
 * 
 * Provides utilities for checking user subscription status.
 * Used for paywall enforcement across the application.
 */

/**
 * Check if a user has an active subscription
 * 
 * @param {object} user - The user object from MongoDB
 * @returns {boolean} True if user has active/trialing/past_due subscription
 */
export function isSubscribed(user) {
  if (!user?.subscription) return false;
  
  const { status, stripeSubscriptionId } = user.subscription;
  
  // Must have a Stripe subscription ID
  if (!stripeSubscriptionId) return false;
  
  // Allow active, trialing, and past_due (card retry period)
  const validStatuses = ['active', 'trialing', 'past_due'];
  return validStatuses.includes(status);
}

/**
 * Get subscription details for API response
 * 
 * @param {object} user - The user object from MongoDB
 * @returns {object} Subscription details
 */
export function getSubscriptionDetails(user) {
  const subscription = user?.subscription || {};
  
  return {
    subscribed: isSubscribed(user),
    status: subscription.status || null,
    stripeCustomerId: subscription.stripeCustomerId || null,
    stripeSubscriptionId: subscription.stripeSubscriptionId || null,
    stripeCallMinutesItemId: subscription.stripeCallMinutesItemId || null,
    stripePriceId: subscription.stripePriceId || null,
    currentPeriodStart: subscription.currentPeriodStart || null,
    currentPeriodEnd: subscription.currentPeriodEnd || null
  };
}

/**
 * Get plan name from price ID
 * 
 * @param {string} priceId - Stripe price ID
 * @param {object} env - Environment config
 * @returns {string} Plan name or 'unknown'
 */
export function getPlanName(priceId, env) {
  if (!priceId || !env?.STRIPE) return 'unknown';
  
  if (priceId === env.STRIPE.PRICE_STARTER) return 'starter';
  if (priceId === env.STRIPE.PRICE_GROWTH) return 'growth';
  if (priceId === env.STRIPE.PRICE_ENTERPRISE) return 'enterprise';
  
  return 'unknown';
}
