/**
 * POST subscription state to book8-core-api (BOO-97A /internal/subscription-sync).
 * Best-effort only — callers must not throw on failure (Stripe webhooks need 200).
 */

import { env } from '@/lib/env'

function coreApiBaseUrl() {
  const raw =
    env.CORE_API_URL ||
    env.CORE_API_BASE_URL ||
    'https://book8-core-api.onrender.com'
  return String(raw).replace(/\/$/, '')
}

function internalSecret() {
  return (
    env.INTERNAL_API_SECRET ||
    env.CORE_API_INTERNAL_SECRET ||
    env.OPS_INTERNAL_SECRET ||
    null
  )
}

export async function syncSubscriptionToCoreApi({
  businessId,
  subscriptionStatus,
  stripeSubscriptionId
}) {
  const INTERNAL_SECRET = internalSecret()

  if (!INTERNAL_SECRET) {
    console.error('[subscription-sync] INTERNAL_API_SECRET / CORE_API_INTERNAL_SECRET not set — cannot sync to core-api')
    return { ok: false, error: 'missing_secret' }
  }

  if (!businessId) {
    console.error('[subscription-sync] businessId required')
    return { ok: false, error: 'missing_business_id' }
  }

  const subId = stripeSubscriptionId != null ? String(stripeSubscriptionId) : ''

  if (!subId) {
    console.error('[subscription-sync] stripeSubscriptionId required')
    return { ok: false, error: 'missing_subscription_id' }
  }

  try {
    const response = await fetch(`${coreApiBaseUrl()}/internal/subscription-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': INTERNAL_SECRET
      },
      body: JSON.stringify({
        businessId,
        subscriptionStatus,
        stripeSubscriptionId: subId
      })
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[subscription-sync] Core-api returned ${response.status}: ${text}`)
      return { ok: false, status: response.status, error: text }
    }

    console.log(
      `[subscription-sync] business=${businessId} status=${subscriptionStatus} synced to core-api`
    )
    return { ok: true }
  } catch (err) {
    console.error('[subscription-sync] Network error:', err.message)
    return { ok: false, error: 'network_error' }
  }
}
