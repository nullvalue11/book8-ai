/**
 * Shared parsing for book8-core-api GET /api/plans/pricing (BOO-MULTI-CURRENCY-1B).
 * Safe for client and server bundles.
 */

/** @param {string | undefined | null} country */
export function normalizeCountryCode(country) {
  const c = String(country || 'US')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  return /^[A-Z]{2}$/.test(c) ? c : 'US'
}

/**
 * @param {unknown} tier
 * @returns {{ amount: number, currency: string, priceId: string | null } | null}
 */
export function normalizeTier(tier) {
  if (!tier || typeof tier !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (tier)
  const rawAmount = o.amount ?? o.unitAmount ?? o.amountMinor ?? o.amount_cents ?? o.amountCents
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
  if (!Number.isFinite(amount)) return null
  const currency = String(o.currency || 'usd').toLowerCase()
  const rawId = o.priceId ?? o.stripePriceId ?? o.stripe_price_id
  const priceId =
    typeof rawId === 'string' && rawId.startsWith('price_') ? rawId : null
  return { amount, currency, priceId }
}

/**
 * @typedef {Object} PlansPricingNormalized
 * @property {string | null} country
 * @property {{ voice: boolean, whatsapp: boolean, sms: boolean } | null} channels
 * @property {ReturnType<typeof normalizeTier>} starter
 * @property {ReturnType<typeof normalizeTier>} growth
 * @property {ReturnType<typeof normalizeTier>} enterprise
 */

/** @param {unknown} raw @returns {PlansPricingNormalized | null} */
export function normalizePlansPricingPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  const root = /** @type {Record<string, unknown>} */ (raw)
  const data =
    root.data && typeof root.data === 'object'
      ? /** @type {Record<string, unknown>} */ (root.data)
      : root
  let channels = null
  if (data.channels && typeof data.channels === 'object') {
    const c = /** @type {Record<string, unknown>} */ (data.channels)
    channels = {
      voice: !!c.voice,
      whatsapp: !!c.whatsapp,
      sms: !!c.sms
    }
  }
  const out = {
    country: typeof data.country === 'string' ? data.country : null,
    channels,
    starter: normalizeTier(data.starter),
    growth: normalizeTier(data.growth),
    enterprise: normalizeTier(data.enterprise)
  }
  if (!out.starter && !out.growth && !out.enterprise) return null
  return out
}

/** @param {PlansPricingNormalized | null} normalized */
export function collectPriceIds(normalized) {
  if (!normalized) return []
  return ['starter', 'growth', 'enterprise']
    .map((k) => normalized[/** @type {'starter'|'growth'|'enterprise'} */ (k)]?.priceId)
    .filter(/** @returns {id is string} */ (id) => typeof id === 'string')
}

export function countryFromBrowserLocale() {
  if (typeof navigator === 'undefined') return 'US'
  const langs = [navigator.language, ...(navigator.languages || [])].filter(Boolean)
  for (const lang of langs) {
    const m = /^[a-z]{2}-([A-Z]{2})/i.exec(String(lang))
    if (m) return m[1].toUpperCase()
  }
  return 'US'
}
