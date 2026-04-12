/**
 * Currency display + blur mask for insights (BOO-101B).
 */

const LOCALE_BY_CURRENCY = {
  CAD: 'en-CA',
  USD: 'en-US',
  AED: 'ar-AE',
  GBP: 'en-GB',
  EUR: 'de-DE'
}

export function formatMoney(amount, currency = 'CAD', locale) {
  const loc = locale || LOCALE_BY_CURRENCY[currency] || 'en-CA'
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat(loc, { style: 'currency', currency }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

/** Replace digits with • while preserving separators/symbol shape */
export function blurMoney(amount, currency = 'CAD', locale) {
  const formatted = formatMoney(amount, currency, locale)
  return formatted.replace(/[0-9]/g, '•')
}
