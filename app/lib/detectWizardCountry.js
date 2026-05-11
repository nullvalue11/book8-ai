/**
 * Country detection for /create Step 0 (BOO-WIZARD-COUNTRY-BRANCH-1B).
 */

import { guessCountryFromTimeZone } from '@/lib/region-data'

export const WIZARD_PRICING_COUNTRY_SESSION_KEY = 'book8_pricing_country_preference'

/**
 * Parse Accept-Language (or navigator.languages) for a region subtag, e.g. en-AE → AE.
 * @param {string | null | undefined} header
 * @returns {string | null}
 */
export function countryFromAcceptLanguage(header) {
  if (!header || typeof header !== 'string') return null
  const parts = header.split(',').map((s) => s.trim().split(';')[0].trim())
  for (const p of parts) {
    const m = /^[a-z]{2}-([A-Z]{2})$/i.exec(p)
    if (m && /^[A-Z]{2}$/.test(m[1])) return m[1].toUpperCase()
  }
  return null
}

/**
 * @param {import('next/navigation').ReadonlyURLSearchParams | URLSearchParams | null} searchParams
 * @param {{ acceptLanguage?: string | null }} [options] — pass `headers().get('accept-language')` from the server for first paint
 */
export function detectWizardCountry(searchParams, options = {}) {
  if (searchParams && typeof searchParams.get === 'function') {
    const urlCountry = searchParams.get('country')
    if (urlCountry && /^[A-Z]{2}$/i.test(String(urlCountry).trim())) {
      return String(urlCountry).trim().toUpperCase()
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(WIZARD_PRICING_COUNTRY_SESSION_KEY)
      if (stored && /^[A-Z]{2}$/i.test(stored)) {
        return stored.toUpperCase()
      }
    } catch {
      /* ignore */
    }
  }
  const fromHeader = countryFromAcceptLanguage(options.acceptLanguage)
  if (fromHeader) return fromHeader
  if (typeof window !== 'undefined') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const tzCountry = guessCountryFromTimeZone(tz)
      if (tzCountry && /^[A-Z]{2}$/i.test(tzCountry)) {
        return tzCountry.toUpperCase()
      }
    } catch {
      /* ignore */
    }
  }
  return 'CA'
}
