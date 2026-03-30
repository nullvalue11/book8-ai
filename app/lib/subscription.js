/**
 * Subscription Status Helper
 *
 * Provides utilities for checking user subscription status.
 * Used for paywall enforcement across the application.
 */

import { getPlanFeatures as getCorePlanFeatures, normalizePlanKey } from './plan-features'

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
 * Whether a business may connect calendars (Google / Outlook).
 * Uses embedded business.subscription, plan fields, billing flag, then the owner's user subscription.
 *
 * @param {object | null} business
 * @param {object | null} [user] - owner user doc (optional fallback)
 */
export function businessHasCalendarEntitlement(business, user = null) {
  if (!business) return false

  const status = business.subscription?.status
  if (['active', 'trialing', 'past_due'].includes(status)) return true

  const planRaw = business.plan ?? business.subscription?.plan
  const planKey = planRaw != null ? String(planRaw).toLowerCase().trim() : ''
  if (['starter', 'growth', 'enterprise'].includes(planKey)) return true

  if (business.features?.billingEnabled === true) return true

  if (user && isSubscribed(user)) return true

  return false
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

/** Days until trial end (ceil); null if no trial end */
export function trialDaysRemaining(trialEndIso) {
  if (!trialEndIso) return null;
  const end = new Date(trialEndIso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
}

/**
 * Billing/paywall feature flags derived from {@link ./plan-features} (Starter = Google only, no AI agent).
 *
 * @param {string} tier - Plan tier
 * @returns {object} Features object
 */
export function getPlanFeatures(tier) {
  if (!tier || tier === 'free') {
    return {
      calendar: false,
      analytics: false,
      agent: false,
      multiCalendar: false,
      advancedAnalytics: false,
      prioritySupport: false,
      teamMembers: false,
      maxCalendars: 0
    }
  }
  const key = normalizePlanKey(tier)
  const f = getCorePlanFeatures(key)
  return {
    calendar: true,
    analytics: true,
    agent: !!f.aiPhoneAgent,
    multiCalendar: !!f.calendarProviders?.includes('outlook'),
    advancedAnalytics: f.analytics === 'full',
    prioritySupport: !!f.prioritySupport,
    teamMembers: key === 'enterprise' || f.teamMembers === -1 || f.teamMembers > 1,
    maxCalendars: f.calendarProviders?.length || 1
  }
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
  const trialEnd = subscription.trialEnd || null;
  const trialDaysLeft =
    subscription.status === 'trialing' && trialEnd ? trialDaysRemaining(trialEnd) : null;

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
    currentPeriodEnd: subscription.currentPeriodEnd || null,
    trialStart: subscription.trialStart || null,
    trialEnd,
    trialDaysLeft
  };
}
