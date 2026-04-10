/**
 * BOO-98B: Cardless Growth trial + grace/locked UI states (client + server safe).
 * @typedef {'loading'|'active'|'grace'|'locked'|'subscribed'} TrialUiStatus
 */

/**
 * @param {object|null} business
 * @param {object|null} user
 * @returns {{ status: TrialUiStatus, daysRemaining: number|null, graceDaysRemaining: number|null, trialEndsAt: string|null, graceEndsAt: string|null }}
 */
export function computeTrialStatus(business, user) {
  if (!business) {
    return { status: 'subscribed', daysRemaining: null, graceDaysRemaining: null, trialEndsAt: null, graceEndsAt: null }
  }

  const sub = business.subscription || {}
  const stripeSubId = sub.stripeSubscriptionId
  const subStatus = String(sub.status || '').toLowerCase()

  if (stripeSubId && (subStatus === 'active' || subStatus === 'past_due')) {
    return { status: 'subscribed', daysRemaining: null, graceDaysRemaining: null, trialEndsAt: null, graceEndsAt: null }
  }

  if (user?.subscription?.stripeSubscriptionId && ['active', 'past_due'].includes(String(user.subscription.status || '').toLowerCase())) {
    return { status: 'subscribed', daysRemaining: null, graceDaysRemaining: null, trialEndsAt: null, graceEndsAt: null }
  }

  const trialEndRaw = sub.trialEnd || sub.trial_end
  const graceEndRaw = sub.trialGraceEndsAt || business.trialGraceEndsAt
  const trialEndMs = trialEndRaw ? new Date(trialEndRaw).getTime() : null
  const graceEndMs = graceEndRaw ? new Date(graceEndRaw).getTime() : null
  const now = Date.now()

  const stripeTrialing = stripeSubId && subStatus === 'trialing'
  const cardlessTrialing =
    subStatus === 'trialing' &&
    !stripeSubId &&
    (sub.trialSource === 'cardless_growth' || sub.trialSource === 'cardless')

  if (stripeTrialing && trialEndMs && !Number.isNaN(trialEndMs)) {
    if (now < trialEndMs) {
      const daysRemaining = Math.max(0, Math.ceil((trialEndMs - now) / 86400000))
      return {
        status: 'active',
        daysRemaining,
        graceDaysRemaining: null,
        trialEndsAt: typeof trialEndRaw === 'string' ? trialEndRaw : new Date(trialEndRaw).toISOString(),
        graceEndsAt: graceEndRaw ? (typeof graceEndRaw === 'string' ? graceEndRaw : new Date(graceEndRaw).toISOString()) : null
      }
    }
    return { status: 'subscribed', daysRemaining: null, graceDaysRemaining: null, trialEndsAt: null, graceEndsAt: null }
  }

  if (!cardlessTrialing) {
    return { status: 'subscribed', daysRemaining: null, graceDaysRemaining: null, trialEndsAt: null, graceEndsAt: null }
  }

  if (trialEndMs && !Number.isNaN(trialEndMs) && now < trialEndMs) {
    const daysRemaining = Math.max(0, Math.ceil((trialEndMs - now) / 86400000))
    return {
      status: 'active',
      daysRemaining,
      graceDaysRemaining: null,
      trialEndsAt: typeof trialEndRaw === 'string' ? trialEndRaw : new Date(trialEndRaw).toISOString(),
      graceEndsAt: graceEndRaw ? (typeof graceEndRaw === 'string' ? graceEndRaw : new Date(graceEndRaw).toISOString()) : null
    }
  }

  const effectiveGraceMs =
    graceEndMs && !Number.isNaN(graceEndMs)
      ? graceEndMs
      : trialEndMs && !Number.isNaN(trialEndMs)
        ? trialEndMs + 7 * 86400000
        : null

  if (effectiveGraceMs && now < effectiveGraceMs) {
    const graceDaysRemaining = Math.max(0, Math.ceil((effectiveGraceMs - now) / 86400000))
    return {
      status: 'grace',
      daysRemaining: null,
      graceDaysRemaining,
      trialEndsAt: trialEndRaw ? (typeof trialEndRaw === 'string' ? trialEndRaw : new Date(trialEndRaw).toISOString()) : null,
      graceEndsAt: new Date(effectiveGraceMs).toISOString()
    }
  }

  return {
    status: 'locked',
    daysRemaining: null,
    graceDaysRemaining: null,
    trialEndsAt: trialEndRaw ? (typeof trialEndRaw === 'string' ? trialEndRaw : new Date(trialEndRaw).toISOString()) : null,
    graceEndsAt: graceEndRaw ? (typeof graceEndRaw === 'string' ? graceEndRaw : new Date(graceEndRaw).toISOString()) : null
  }
}
