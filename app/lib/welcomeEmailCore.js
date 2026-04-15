/**
 * Pure helpers for BOO-109A welcome email (unit-tested without Resend/Mongo).
 */

import { format } from 'date-fns'
import enUS from 'date-fns/locale/en-US/index.js'
import fr from 'date-fns/locale/fr/index.js'
import es from 'date-fns/locale/es/index.js'
import arSA from 'date-fns/locale/ar-SA/index.js'
import { normalizePrimaryLanguage } from './primary-languages.js'

const LANG_LABEL_UPPER = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  ar: 'AR',
  zh: 'ZH',
  hi: 'HI',
  pt: 'PT',
  de: 'DE',
  ja: 'JA',
  ko: 'KO',
  it: 'IT',
  nl: 'NL',
  ru: 'RU',
  tr: 'TR',
  pl: 'PL',
  vi: 'VI',
  id: 'ID',
  th: 'TH',
  uk: 'UK',
  cs: 'CS',
  ro: 'RO',
  el: 'EL',
  he: 'HE',
  ms: 'MS',
  sv: 'SV',
  da: 'DA',
  fi: 'FI',
  no: 'NO',
  hr: 'HR'
}

/** @param {string | null | undefined} e164 */
export function formatE164ForDisplay(e164) {
  if (!e164 || typeof e164 !== 'string') return null
  const t = e164.trim()
  if (!t) return null
  if (t.startsWith('+1')) {
    const d = t.replace(/\D/g, '')
    if (d.length === 11 && d.startsWith('1')) {
      const n = d.slice(1)
      return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
    }
  }
  return t
}

/** @param {object} business */
export function businessEligibleForWelcomeEmail(business) {
  if (!business) return false
  const st = business.subscription?.status
  if (st === 'trialing' || st === 'active') return true
  if (business.subscription?.trialSource === 'cardless_growth' && business.subscription?.trialEnd) return true
  if (business.subscription?.trialEnd && st !== 'canceled' && st !== 'none') return true
  if (business.plan && ['growth', 'starter', 'enterprise'].includes(business.plan) && business.features?.billingEnabled)
    return true
  return false
}

/** @param {object} business */
export function buildSupportedLanguagesDisplay(business) {
  const primary = normalizePrimaryLanguage(business?.primaryLanguage)
  const upper = (c) => LANG_LABEL_UPPER[c] || String(c).toUpperCase().slice(0, 3)
  const codes = [primary]
  if (business?.multilingualEnabled !== false) {
    for (const c of ['fr', 'es', 'ar']) {
      if (!codes.includes(c)) codes.push(c)
    }
  }
  return codes.map(upper).join(' · ')
}

/**
 * @param {string} trialEndIso
 * @param {string} locale
 */
export function formatTrialEndForLocale(trialEndIso, locale) {
  if (!trialEndIso) return null
  const d = new Date(trialEndIso)
  if (Number.isNaN(d.getTime())) return null
  const loc = locale === 'fr' ? fr : locale === 'es' ? es : locale === 'ar' ? arSA : enUS
  return format(d, 'PPPP', { locale: loc })
}

/** @param {object} user @param {object} business */
export function resolveOwnerFirstName(user, business) {
  const n = typeof user?.name === 'string' ? user.name.trim() : ''
  if (n) {
    const first = n.split(/\s+/)[0]
    if (first) return first
  }
  const em = typeof business?.ownerEmail === 'string' ? business.ownerEmail : user?.email || ''
  const local = em.includes('@') ? em.split('@')[0].trim() : ''
  if (local && /^[a-zA-Z][a-zA-Z'-]*$/.test(local)) {
    return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
  }
  return 'there'
}
