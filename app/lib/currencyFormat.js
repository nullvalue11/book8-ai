export const CURRENCY_SYMBOLS = {
  usd: '$',
  aed: 'AED ',
  cad: 'CA$',
  gbp: '£',
  eur: '€'
}

export const CURRENCY_POSITIONS = {
  usd: 'prefix', // $19
  aed: 'prefix', // AED 70
  cad: 'prefix', // CA$25
  gbp: 'prefix', // £15
  eur: 'prefix' // €17
}

export function formatPrice(amountInMinorUnits, currency) {
  const major = Math.round(amountInMinorUnits / 100)
  const code = String(currency || 'usd').toLowerCase()
  const symbol = CURRENCY_SYMBOLS[code] || '$'
  return `${symbol}${major}`
}
