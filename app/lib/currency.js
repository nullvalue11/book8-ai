/**
 * Detect the user's currency based on browser locale and timezone.
 * Falls back to USD if detection fails.
 */

const TIMEZONE_TO_CURRENCY = {
  // North America
  'America/Toronto': 'CAD',
  'America/Vancouver': 'CAD',
  'America/Montreal': 'CAD',
  'America/Edmonton': 'CAD',
  'America/Winnipeg': 'CAD',
  'America/Halifax': 'CAD',
  'America/St_Johns': 'CAD',
  'America/New_York': 'USD',
  'America/Chicago': 'USD',
  'America/Denver': 'USD',
  'America/Los_Angeles': 'USD',
  'America/Phoenix': 'USD',
  'America/Anchorage': 'USD',
  'Pacific/Honolulu': 'USD',

  // Europe
  'Europe/London': 'GBP',
  'Europe/Paris': 'EUR',
  'Europe/Berlin': 'EUR',
  'Europe/Madrid': 'EUR',
  'Europe/Rome': 'EUR',
  'Europe/Amsterdam': 'EUR',
  'Europe/Brussels': 'EUR',
  'Europe/Vienna': 'EUR',
  'Europe/Dublin': 'EUR',
  'Europe/Lisbon': 'EUR',
  'Europe/Helsinki': 'EUR',
  'Europe/Stockholm': 'SEK',
  'Europe/Oslo': 'NOK',
  'Europe/Copenhagen': 'DKK',
  'Europe/Zurich': 'CHF',
  'Europe/Warsaw': 'PLN',
  'Europe/Prague': 'CZK',
  'Europe/Budapest': 'HUF',
  'Europe/Bucharest': 'RON',
  'Europe/Istanbul': 'TRY',
  'Europe/Moscow': 'RUB',

  // Middle East
  'Asia/Dubai': 'AED',
  'Asia/Riyadh': 'SAR',
  'Asia/Qatar': 'QAR',
  'Asia/Kuwait': 'KWD',
  'Asia/Bahrain': 'BHD',
  'Asia/Muscat': 'OMR',
  'Asia/Jerusalem': 'ILS',

  // Asia Pacific
  'Asia/Tokyo': 'JPY',
  'Asia/Seoul': 'KRW',
  'Asia/Shanghai': 'CNY',
  'Asia/Hong_Kong': 'HKD',
  'Asia/Singapore': 'SGD',
  'Asia/Kolkata': 'INR',
  'Asia/Karachi': 'PKR',
  'Asia/Dhaka': 'BDT',
  'Asia/Bangkok': 'THB',
  'Asia/Jakarta': 'IDR',
  'Asia/Manila': 'PHP',
  'Asia/Kuala_Lumpur': 'MYR',
  'Asia/Ho_Chi_Minh': 'VND',

  // Oceania
  'Australia/Sydney': 'AUD',
  'Australia/Melbourne': 'AUD',
  'Australia/Brisbane': 'AUD',
  'Australia/Perth': 'AUD',
  'Pacific/Auckland': 'NZD',

  // Africa
  'Africa/Johannesburg': 'ZAR',
  'Africa/Lagos': 'NGN',
  'Africa/Cairo': 'EGP',
  'Africa/Nairobi': 'KES',
  'Africa/Casablanca': 'MAD',

  // South America
  'America/Sao_Paulo': 'BRL',
  'America/Argentina/Buenos_Aires': 'ARS',
  'America/Santiago': 'CLP',
  'America/Bogota': 'COP',
  'America/Lima': 'PEN',
  'America/Mexico_City': 'MXN'
}

const CURRENCY_SYMBOLS = {
  USD: '$',
  CAD: 'CA$',
  GBP: '£',
  EUR: '€',
  AUD: 'A$',
  NZD: 'NZ$',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  INR: '₹',
  AED: 'AED',
  SAR: 'SAR',
  SGD: 'S$',
  HKD: 'HK$',
  MYR: 'RM',
  THB: '฿',
  PHP: '₱',
  IDR: 'Rp',
  BRL: 'R$',
  MXN: 'MX$',
  ZAR: 'R',
  NGN: '₦',
  EGP: 'E£',
  KES: 'KSh',
  TRY: '₺',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  CHF: 'CHF',
  ILS: '₪',
  PKR: '₨',
  BDT: '৳',
  VND: '₫',
  COP: 'COL$',
  PEN: 'S/.',
  CLP: 'CL$',
  ARS: 'AR$',
  RON: 'lei',
  RUB: '₽',
  QAR: 'QAR',
  KWD: 'KWD',
  BHD: 'BHD',
  OMR: 'OMR',
  MAD: 'MAD'
}

/**
 * Detect currency from browser timezone
 */
export function detectCurrency() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TIMEZONE_TO_CURRENCY[tz] || 'USD'
  } catch {
    return 'USD'
  }
}

/**
 * Detect currency from a business timezone string (e.g. "America/Toronto")
 */
export function currencyFromTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return 'USD'
  return TIMEZONE_TO_CURRENCY[timezone] || 'USD'
}

/**
 * Get the symbol for a currency code
 */
export function getCurrencySymbol(currencyCode) {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}

/**
 * Format a price with the appropriate currency symbol
 */
export function formatPrice(amount, currencyCode) {
  if (amount == null) return null
  const code = currencyCode || 'USD'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    const symbol = getCurrencySymbol(code)
    return `${symbol}${amount}`
  }
}

/**
 * Format a public booking service price (supports price | priceAmount | priceCents from API).
 */
export function formatPublicServicePriceDisplay(svc) {
  if (!svc) return null
  const currency = svc.currency || 'USD'
  const { price, priceAmount, priceCents } = svc
  let amount = null
  if (price != null && price !== '') {
    if (typeof price === 'number' && !Number.isNaN(price)) {
      amount = price
    } else {
      const str = String(price).trim().replace(/^\$/, '').trim()
      const n = parseFloat(str)
      if (Number.isFinite(n)) amount = n
    }
  }
  if (amount == null && priceAmount != null && priceAmount !== '') {
    const n = Number(priceAmount)
    if (!Number.isNaN(n)) amount = n
  }
  if (amount == null && priceCents != null && typeof priceCents === 'number') {
    amount = priceCents / 100
  }
  if (amount == null) return null
  return formatPrice(amount, currency)
}
