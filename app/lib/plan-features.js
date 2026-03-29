/**
 * Plan feature definitions — mirrors core-api plan config.
 * Used for UI display; core-api enforces access.
 */

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 29,
    features: {
      maxBusinesses: 1,
      bookingChannels: ['web'],
      calendarProviders: ['google'],
      multilingual: false,
      smsConfirmations: false,
      emailConfirmations: true,
      aiPhoneAgent: false,
      analytics: 'basic',
      maxCallMinutes: 0,
      teamMembers: 1,
      apiAccess: false
    }
  },
  growth: {
    name: 'Growth',
    price: 99,
    features: {
      maxBusinesses: 5,
      bookingChannels: ['web', 'voice', 'sms'],
      calendarProviders: ['google', 'outlook'],
      multilingual: true,
      smsConfirmations: true,
      emailConfirmations: true,
      aiPhoneAgent: true,
      analytics: 'full',
      maxCallMinutes: 200,
      teamMembers: 3,
      apiAccess: false
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    features: {
      maxBusinesses: -1,
      bookingChannels: ['web', 'voice', 'sms'],
      calendarProviders: ['google', 'outlook'],
      multilingual: true,
      smsConfirmations: true,
      emailConfirmations: true,
      aiPhoneAgent: true,
      analytics: 'full',
      maxCallMinutes: -1,
      teamMembers: -1,
      apiAccess: true
    }
  }
}

export function normalizePlanKey(plan) {
  if (plan == null || plan === '') return 'starter'
  const k = String(plan).toLowerCase().trim()
  if (k === 'null' || k === 'undefined') return 'starter'
  if (k === 'growth' || k === 'enterprise' || k === 'starter') return k
  return 'starter'
}

export function getPlanFeatures(plan) {
  const key = normalizePlanKey(plan)
  return PLANS[key]?.features || PLANS.starter.features
}

/**
 * Boolean feature flags (see PLANS.features keys).
 * For non-boolean fields, uses truthiness / length as appropriate.
 */
export function isFeatureAvailable(plan, feature) {
  const features = getPlanFeatures(plan)
  const v = features[feature]
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (Array.isArray(v)) return v.length > 0
  return !!v
}

export function getPlanName(plan) {
  const key = normalizePlanKey(plan)
  return PLANS[key]?.name || PLANS.starter.name
}

export function hasOutlookCalendar(plan) {
  return !!getPlanFeatures(plan).calendarProviders?.includes('outlook')
}

/** Voice + SMS channels (Growth+) — for public “call/text to book”. */
export function hasVoiceOrSmsBooking(plan) {
  const ch = getPlanFeatures(plan).bookingChannels || []
  return ch.includes('voice') || ch.includes('sms')
}

/**
 * Normalized limits for dashboard components (AnalyticsDashboard, booking line, etc.)
 */
export function getUiPlanLimits(plan) {
  const key = normalizePlanKey(plan)
  const f = getPlanFeatures(key)
  return {
    aiPhoneAgent: !!f.aiPhoneAgent,
    smsConfirmations: !!f.smsConfirmations,
    advancedAnalytics: f.analytics === 'full',
    outlookCalendar: !!f.calendarProviders?.includes('outlook'),
    multilingual: !!f.multilingual
  }
}
