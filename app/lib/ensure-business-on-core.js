/**
 * BOO-72B: Ensure core-api has the business tenant before phone-setup or sync-to-core.
 * Onboarding is local-first (BOO-56); Stripe webhook may race or miss — Step 6 must not 502.
 */

import { provisionOnCoreApi } from './provision-business'
import { resolveBusinessPlanKey } from './subscription'
import {
  getCoreApiBaseUrl,
  getCoreApiInternalHeadersJson,
  hasCoreApiInternalCredentials
} from './core-api-internal'

/**
 * @param {string} baseUrl - core-api base (no trailing slash)
 * @param {string} businessId
 * @returns {Promise<Response>}
 */
export async function fetchCoreBusinessGet(baseUrl, businessId) {
  return fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}`, {
    method: 'GET',
    headers: getCoreApiInternalHeadersJson(),
    cache: 'no-store'
  })
}

/**
 * If core returns 404, run provision-from-stripe (idempotent) with phone flags aligned to Step 6 choice.
 *
 * @param {object} params
 * @param {object} params.business - Mongo business doc
 * @param {string} [params.ownerEmail]
 * @param {'new'|'forward'|null|undefined} params.phoneSetup
 * @param {string|null} params.resolvedMethod - 'dedicated' | 'forward' | ...
 */
export async function ensureCoreTenantExistsForPhoneStep({
  business,
  ownerEmail,
  phoneSetup,
  resolvedMethod
}) {
  if (!business?.businessId) {
    return { ok: false, error: 'Invalid business' }
  }

  const baseUrl = getCoreApiBaseUrl()

  if (!hasCoreApiInternalCredentials()) {
    return { ok: false, error: 'Core API credentials not configured' }
  }

  let coreRes
  try {
    coreRes = await fetchCoreBusinessGet(baseUrl, business.businessId)
  } catch (e) {
    console.error('[ensure-business-on-core] GET core business failed', e)
    return { ok: false, error: 'Core-api unreachable' }
  }

  if (coreRes.ok) {
    return { ok: true, alreadyExisted: true }
  }

  if (coreRes.status !== 404) {
    const text = await coreRes.text().catch(() => '')
    console.error('[ensure-business-on-core] Unexpected GET /api/businesses/:id', coreRes.status, text)
    return { ok: false, error: 'Could not verify business on booking service' }
  }

  const plan = resolveBusinessPlanKey(business)
  const isForward = phoneSetup === 'forward' || resolvedMethod === 'forward'
  /** Growth+/enterprise + forward: tenant without pool number; dedicated path uses core defaults. */
  const skipPhoneProvisioning = plan === 'starter' ? true : isForward ? true : undefined
  const requestDedicatedPhoneLine = plan === 'starter' ? false : isForward ? false : undefined

  const email = ownerEmail || business.ownerEmail || undefined

  const provisioned = await provisionOnCoreApi({
    businessId: business.businessId,
    name: business.name || 'Business',
    plan,
    timezone: business.timezone || 'America/Toronto',
    category: business.category,
    customCategory: business.customCategory,
    primaryLanguage: business.primaryLanguage,
    multilingualEnabled: business.multilingualEnabled,
    email,
    stripeCustomerId: business.subscription?.stripeCustomerId ?? undefined,
    stripeSubscriptionId: business.subscription?.stripeSubscriptionId ?? undefined,
    ...(skipPhoneProvisioning !== undefined && { skipPhoneProvisioning }),
    ...(requestDedicatedPhoneLine !== undefined && { requestDedicatedPhoneLine })
  })

  if (!provisioned) {
    return { ok: false, error: 'Failed to create business on booking service. Please try again.' }
  }

  return { ok: true, provisioned: true }
}
