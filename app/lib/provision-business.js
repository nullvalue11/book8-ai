/**
 * Provision a business tenant in core-api.
 * Used by: Stripe webhook (checkout.session.completed), business registration (subscription inheritance).
 */

import { env } from '@/lib/env'

/**
 * Call core-api's provision-from-stripe to create tenant + assign phone number.
 * Idempotent — safe to call multiple times.
 *
 * @param {object} opts
 * @param {string} opts.businessId - biz_xxx format
 * @param {string} opts.name - Business name
 * @param {string} opts.plan - starter | growth | enterprise
 * @param {string} [opts.timezone] - IANA timezone, default America/Toronto
 * @param {string} [opts.category] - Business category key
 * @param {string} [opts.customCategory] - Free-text type when category is other
 * @param {string} [opts.email] - Owner email (alias for ownerEmail)
 * @param {string} [opts.stripeCustomerId] - From Stripe session.customer
 * @param {string} [opts.stripeSubscriptionId] - From Stripe session.subscription
 */
export async function provisionOnCoreApi({
  businessId,
  name,
  plan,
  timezone = 'America/Toronto',
  category,
  customCategory,
  primaryLanguage,
  multilingualEnabled,
  email,
  stripeCustomerId,
  stripeSubscriptionId
}) {
  const coreApiUrl =
    env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET

  if (!secret) {
    console.warn('[provision] No internal secret — skipping core-api provisioning')
    return null
  }

  const baseUrl = coreApiUrl.replace(/\/$/, '')

  try {
    console.log('[provision] Triggering core-api provisioning for:', businessId)

    const body = {
      businessId,
      name,
      plan: plan || 'starter',
      timezone,
      ...(category != null && { category }),
      ...(customCategory != null &&
        String(customCategory).trim() && { customCategory: String(customCategory).trim() }),
      ...(primaryLanguage && { primaryLanguage }),
      ...(multilingualEnabled != null && { multilingualEnabled: !!multilingualEnabled }),
      ...(email && { email, ownerEmail: email }),
      ...(stripeCustomerId != null && { stripeCustomerId }),
      ...(stripeSubscriptionId != null && { stripeSubscriptionId })
    }

    const response = await fetch(`${baseUrl}/internal/provision-from-stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret,
        'x-internal-secret': secret
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown')
      console.error('[provision] Core-api returned:', response.status, errorText)
      return null
    }

    const data = await response.json()
    console.log('[provision] Core-api response:', JSON.stringify(data))
    return data
  } catch (err) {
    console.error('[provision] Failed:', err.message)
    return null
  }
}
