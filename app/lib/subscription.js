/**
 * Subscription Status Helper (server / API entry — binds validated env).
 * Client components must import from ./subscription-shared instead to avoid bundling ./env.
 */

import { env } from './env'
import {
  resolveBusinessPlanKey as resolveBusinessPlanKeyWithConfig,
  isSubscribed,
  businessHasCalendarEntitlement,
  getPlanTier as getPlanTierWithConfig,
  getPlanName as getPlanNameWithConfig,
  trialDaysRemaining,
  getPlanFeatures,
  getSubscriptionDetails as getSubscriptionDetailsWithConfig,
} from './subscription-shared'

export {
  isSubscribed,
  businessHasCalendarEntitlement,
  trialDaysRemaining,
  getPlanFeatures,
}

export function resolveBusinessPlanKey(business) {
  return resolveBusinessPlanKeyWithConfig(business, env)
}

export function getPlanTier(priceId, config = env) {
  return getPlanTierWithConfig(priceId, config)
}

export function getPlanName(priceId, config = env) {
  return getPlanNameWithConfig(priceId, config)
}

export function getSubscriptionDetails(user, config) {
  return getSubscriptionDetailsWithConfig(user, config === undefined ? env : config)
}
