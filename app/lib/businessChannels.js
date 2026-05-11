/**
 * Regional channel availability for onboarding + pricing (BOO-WIZARD-COUNTRY-BRANCH-1B).
 * When book8-core-api exposes GET /api/business/channels, merge server-side in the API route.
 */

/**
 * @param {string | undefined | null} countryCode ISO 3166-1 alpha-2
 * @returns {{ voice: boolean, whatsapp: boolean, sms: boolean }}
 */
export function defaultChannelsForCountry(countryCode) {
  const c = String(countryCode || 'CA')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  if (c === 'AE') {
    return { voice: false, whatsapp: true, sms: false }
  }
  return { voice: true, whatsapp: true, sms: true }
}

/** @param {unknown} raw */
export function normalizeChannelsPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const root = /** @type {Record<string, unknown>} */ (raw)
  const o =
    root.channels && typeof root.channels === 'object'
      ? /** @type {Record<string, unknown>} */ (root.channels)
      : root
  return {
    voice: !!o.voice,
    whatsapp: !!o.whatsapp,
    sms: !!o.sms
  }
}
