import { getCoreApiBaseUrl, getCoreApiInternalHeadersJson } from '@/lib/core-api-internal'
import { normalizeCountryCode, normalizePlansPricingPayload } from '@/lib/plansPricingPublic'

/**
 * Server-only: fetch localized plan pricing + Stripe price IDs from book8-core-api.
 * @param {string | undefined | null} country
 */
export async function fetchPlansPricingFromCore(country) {
  const base = getCoreApiBaseUrl()
  const cc = normalizeCountryCode(country)
  const url = `${base}/api/plans/pricing?country=${encodeURIComponent(cc)}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: getCoreApiInternalHeadersJson(),
      cache: 'no-store'
    })
    if (!res.ok) return null
    const json = await res.json().catch(() => null)
    return normalizePlansPricingPayload(json)
  } catch {
    return null
  }
}
