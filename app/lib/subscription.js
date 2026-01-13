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
 * Get plan tier from price ID
 * 
 * @param {string} priceId - Stripe price ID
 * @param {object} env - Environment config
 * @returns {string} Plan tier: 'free' | 'starter' | 'growth' | 'enterprise'
 */
export function getPlanTier(priceId, env) {
  if (!priceId || !env?.STRIPE) return 'free';
  
  if (priceId === env.STRIPE.PRICE_STARTER) return 'starter';
  if (priceId === env.STRIPE.PRICE_GROWTH) return 'growth';
  if (priceId === env.STRIPE.PRICE_ENTERPRISE) return 'enterprise';
  
  return 'free';
}

/**
 * Get plan name from price ID (display name)
 * 
 * @param {string} priceId - Stripe price ID
 * @param {object} env - Environment config
 * @returns {string} Plan name or 'Free'
 */
export function getPlanName(priceId, env) {
  const tier = getPlanTier(priceId, env);
  const names = {
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise'
  };
  return names[tier] || 'Free';
}

/**
 * Get features available for a plan tier
 * 
 * @param {string} tier - Plan tier
 * @returns {object} Features object
 */
export function getPlanFeatures(tier) {
  const features = {
    free: {
      calendar: false,
      analytics: false,
      agent: false,
      multiCalendar: false,
      advancedAnalytics: false,
      prioritySupport: false,
      teamMembers: false,
      maxCalendars: 0
    },
    starter: {
      calendar: true,
      analytics: true,
      agent: true,
      multiCalendar: false,
      advancedAnalytics: false,
      prioritySupport: false,
      teamMembers: false,
      maxCalendars: 1
    },
    growth: {
      calendar: true,
      analytics: true,
      agent: true,
      multiCalendar: true,
      advancedAnalytics: false,
      prioritySupport: false,
      teamMembers: false,
      maxCalendars: 3
    },
    enterprise: {
      calendar: true,
      analytics: true,
      agent: true,
      multiCalendar: true,
      advancedAnalytics: true,
      prioritySupport: true,
      teamMembers: true,
      maxCalendars: 10
    }
  };
  
  return features[tier] || features.free;
}

/**
 * Get subscription details for API response
 * 
 * @param {object} user - The user object from MongoDB
 * @param {object} env - Environment config
 * @returns {object} Subscription details
 */
export function getSubscriptionDetails(user, env = null) {
  const subscription = user?.subscription || {};
  const priceId = subscription.stripePriceId || null;
  const tier = env ? getPlanTier(priceId, env) : (priceId ? 'starter' : 'free');
  
  return {
    subscribed: isSubscribed(user),
    status: subscription.status || null,
    planTier: tier,
    planName: env ? getPlanName(priceId, env) : tier.charAt(0).toUpperCase() + tier.slice(1),
    features: getPlanFeatures(tier),
    stripeCustomerId: subscription.stripeCustomerId || null,
    stripeSubscriptionId: subscription.stripeSubscriptionId || null,
    stripeCallMinutesItemId: subscription.stripeCallMinutesItemId || null,
    stripePriceId: priceId,
    currentPeriodStart: subscription.currentPeriodStart || null,
    currentPeriodEnd: subscription.currentPeriodEnd || null
  };
}
