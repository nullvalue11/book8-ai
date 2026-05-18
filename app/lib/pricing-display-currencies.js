/** Fixed marketing price ladder (UI display until Stripe multi-currency routing ships). */
export const DISPLAY_CURRENCIES = ['USD', 'CAD']

export const PRICES = {
  USD: {
    starter: { amount: 19, perMinute: '0.075', symbol: '$', code: 'USD' },
    growth: { amount: 69, perMinute: '0.075', symbol: '$', code: 'USD' },
    enterprise: { amount: 199, perMinute: '0.075', symbol: '$', code: 'USD' }
  },
  CAD: {
    starter: { amount: 29, perMinute: '0.10', symbol: '$', code: 'CAD' },
    growth: { amount: 99, perMinute: '0.10', symbol: '$', code: 'CAD' },
    enterprise: { amount: 299, perMinute: '0.10', symbol: '$', code: 'CAD' }
  }
}

/** @param {string | null | undefined} raw */
export function normalizeDisplayCurrency(raw) {
  const c = String(raw || '')
    .trim()
    .toUpperCase()
  return DISPLAY_CURRENCIES.includes(c) ? c : 'USD'
}

/** @param {'USD' | 'CAD'} currency */
export function displayCurrencyToCountry(currency) {
  return currency === 'CAD' ? 'CA' : 'US'
}

/** @param {'USD' | 'CAD'} currency */
export function displayCurrencyToBillingCode(currency) {
  return currency === 'CAD' ? 'cad' : 'usd'
}

/** @param {'starter' | 'growth' | 'enterprise'} planId @param {'USD' | 'CAD'} currency */
export function getDisplayPlanPrice(planId, currency) {
  const cur = normalizeDisplayCurrency(currency)
  return PRICES[cur][planId]
}

/** @param {'USD' | 'CAD'} currency */
export function getUsagePerMinuteRate(currency) {
  const cur = normalizeDisplayCurrency(currency)
  return PRICES[cur].starter
}
