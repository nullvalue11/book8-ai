/**
 * Use when routing from marketing (landing/pricing) so returning users can register
 * another business instead of auto-resuming the wizard from an existing one.
 */
export const SETUP_NEW_BUSINESS_QUERY = 'newBusiness=1'

export const SETUP_NEW_BUSINESS_PATH = `/setup?${SETUP_NEW_BUSINESS_QUERY}`

/** @param {Record<string, string | undefined>} [extra] e.g. { plan: 'growth', redirect: '/pricing' } */
export function setupUrlWithNewBusiness(extra = {}) {
  const q = new URLSearchParams()
  q.set('newBusiness', '1')
  if (extra.plan) q.set('plan', extra.plan)
  if (extra.redirect) q.set('redirect', extra.redirect)
  return `/setup?${q.toString()}`
}
