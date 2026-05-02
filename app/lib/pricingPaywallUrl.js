/**
 * Build /pricing URL with paywall=1 and optional businessId (for Stripe checkout metadata).
 * @param {{ businessId?: string | null, feature?: string | null }} opts
 * @returns {string} e.g. /pricing?paywall=1&businessId=biz_xxx&feature=calendar
 */
export function pricingPaywallUrl(opts = {}) {
  const q = new URLSearchParams()
  q.set('paywall', '1')
  const bid =
    opts.businessId != null && String(opts.businessId).trim()
      ? String(opts.businessId).trim()
      : ''
  if (bid) q.set('businessId', bid)
  if (opts.feature) q.set('feature', String(opts.feature))
  return `/pricing?${q.toString()}`
}
