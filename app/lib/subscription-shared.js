/**
 * Subscription helpers safe for client bundles (no ./env import).
 * Pass the loaded env object from server code, or null on the client (Stripe price→tier maps only).
 */

import { getPlanFeatures as getCorePlanFeatures, normalizePlanKey } from './plan-features'

/**
 * @param {object | null | undefined} business
 * @param {object | null | undefined} config - Same shape as env (uses config.STRIPE price IDs) or null on client
 * @returns {'starter'|'growth'|'enterprise'}
 */
export function resolveBusinessPlanKey(business, config = null) {
  if (!business) return normalizePlanKey(null)
  const fromSubscriptionPlan =
    business.subscriptionPlan != null && String(business.subscriptionPlan).trim() !== ''
      ? String(business.subscriptionPlan).trim()
      : null
  if (fromSubscriptionPlan) {
    const lower = fromSubscriptionPlan.toLowerCase()
    if (lower === 'starter' || lower === 'growth' || lower === 'enterprise') return lower
    const tier = getPlanTier(fromSubscriptionPlan, config)
    if (tier !== 'free') return tier
  }
  const raw = business.plan ?? business.subscription?.plan
  if (raw != null && String(raw).trim() !== '') {
    const str = String(raw).trim()
    const lower = str.toLowerCase()
    if (lower === 'starter' || lower === 'growth' || lower === 'enterprise') return lower
    const tier = getPlanTier(str, config)
    if (tier !== 'free') return tier
  }
  const priceId = business.subscription?.stripePriceId
  if (priceId) {
    const tier = getPlanTier(String(priceId), config)
    if (tier !== 'free') return tier
  }
  return normalizePlanKey(null)
}

export function isSubscribed(user) {
  if (!user?.subscription) return false

  const { status, stripeSubscriptionId } = user.subscription

  if (!stripeSubscriptionId) return false

  const validStatuses = ['active', 'trialing', 'past_due']
  return validStatuses.includes(status)
}

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
 * @param {string} priceId
 * @param {object | null | undefined} config - env-like object with STRIPE price IDs
 */
export function getPlanTier(priceId, config) {
  if (!priceId || !config?.STRIPE) return 'free'

  if (priceId === config.STRIPE.PRICE_STARTER) return 'starter'
  if (priceId === config.STRIPE.PRICE_GROWTH) return 'growth'
  if (priceId === config.STRIPE.PRICE_ENTERPRISE) return 'enterprise'

  return 'free'
}

export function getPlanName(priceId, config) {
  const tier = getPlanTier(priceId, config)
  const names = {
    free: 'Free',
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise',
  }
  return names[tier] || 'Free'
}

export function trialDaysRemaining(trialEndIso) {
  if (!trialEndIso) return null
  const end = new Date(trialEndIso).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)))
}

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
      maxCalendars: 0,
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
    maxCalendars: f.calendarProviders?.length || 1,
  }
}

export function getSubscriptionDetails(user, config = null) {
  const subscription = user?.subscription || {}
  const priceId = subscription.stripePriceId || null
  const tier = config ? getPlanTier(priceId, config) : priceId ? 'starter' : 'free'
  const subscribed = isSubscribed(user)
  const trialEnd = subscription.trialEnd || null
  const trialDaysLeft =
    subscription.status === 'trialing' && trialEnd ? trialDaysRemaining(trialEnd) : null

  return {
    subscribed,
    status: subscription.status || null,
    planTier: subscribed ? tier : 'free',
    planName: subscribed
      ? config
        ? getPlanName(priceId, config)
        : tier.charAt(0).toUpperCase() + tier.slice(1)
      : 'No plan',
    features: getPlanFeatures(subscribed ? tier : 'free'),
    stripeCustomerId: subscription.stripeCustomerId || null,
    stripeSubscriptionId: subscription.stripeSubscriptionId || null,
    stripeCallMinutesItemId: subscription.stripeCallMinutesItemId || null,
    stripePriceId: priceId,
    currentPeriodStart: subscription.currentPeriodStart || null,
    currentPeriodEnd: subscription.currentPeriodEnd || null,
    trialStart: subscription.trialStart || null,
    trialEnd,
    trialDaysLeft,
  }
}
