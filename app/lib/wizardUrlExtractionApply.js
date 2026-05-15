/**
 * Map Perplexity extraction + vanilla infer-profile payloads into /setup wizard state.
 * BOO-PERPLEXITY-DOMAIN-EXTRACT-1B
 */

import { COUNTRY_OPTIONS } from '@/lib/countries'
import { normalizePrimaryLanguage } from '@/lib/primary-languages'
import { isValidIanaTimeZone } from '@/lib/timezones'

const SETUP_CATEGORIES = new Set(['barber', 'dental', 'spa', 'fitness', 'medical', 'restaurant', 'other'])

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** @param {string} t */
function padHhMm(t) {
  const m = String(t || '').trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null
  h = Math.min(23, Math.max(0, h))
  const m2 = Math.min(59, Math.max(0, mm))
  return `${String(h).padStart(2, '0')}:${String(m2).padStart(2, '0')}`
}

/** @param {unknown} cell */
function parseHoursCell(cell) {
  if (cell == null) return null
  const s = String(cell).trim().toLowerCase()
  if (!s || s === 'null') return null
  if (s === 'closed' || s === 'closed.') return []
  const m = s.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/)
  if (!m) return null
  const a = padHhMm(m[1])
  const b = padHhMm(m[2])
  if (!a || !b) return null
  return [{ start: a, end: b }]
}

/**
 * @param {unknown} raw
 */
function mapPerplexityCategoryToSetup(raw) {
  const c = String(raw || '')
    .trim()
    .toLowerCase()
  const table = {
    barber_shop: 'barber',
    hair_salon: 'barber',
    beauty_salon: 'spa',
    nail_salon: 'spa',
    spa: 'spa',
    gym: 'fitness',
    fitness_studio: 'fitness',
    yoga_studio: 'fitness',
    pilates_studio: 'fitness',
    car_wash: 'other',
    auto_repair: 'other',
    detailing: 'other',
    restaurant: 'restaurant',
    cafe: 'restaurant',
    bar: 'restaurant',
    dentist: 'dental',
    physiotherapist: 'medical',
    chiropractor: 'medical',
    massage_therapist: 'medical',
    pet_grooming: 'other',
    veterinary: 'other',
    tattoo_parlor: 'other',
    piercing_studio: 'other',
    other: 'other'
  }
  const mapped = table[c]
  if (mapped && SETUP_CATEGORIES.has(mapped)) return { category: mapped, custom: '' }
  return { category: 'other', custom: c && c !== 'null' ? c.replace(/_/g, ' ') : '' }
}

/**
 * @param {string} labelOrCode
 */
function countryLabelToCode(labelOrCode) {
  const t = String(labelOrCode || '').trim()
  if (!t) return null
  if (/^[A-Z]{2}$/i.test(t)) return t.toUpperCase().slice(0, 2)
  const hit = COUNTRY_OPTIONS.find((c) => c.label.toLowerCase() === t.toLowerCase())
  return hit?.code ?? null
}

/**
 * @param {string} url
 */
export function normalizeWizardWebsiteUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u.replace(/^\/+/, '')}`
}

export function makeStep5RowKey() {
  return `sr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {unknown} services
 */
function mapServicesToStep5Rows(services) {
  if (!Array.isArray(services)) return []
  const rows = []
  for (const s of services) {
    if (!s || typeof s !== 'object') continue
    const name = typeof s.name === 'string' ? s.name.trim().slice(0, 120) : ''
    if (!name) continue
    let durationMinutes = 30
    if (typeof s.durationMinutes === 'number' && Number.isFinite(s.durationMinutes)) {
      durationMinutes = Math.max(5, Math.min(480, Math.round(s.durationMinutes)))
    }
    let priceStr = ''
    if (typeof s.price === 'number' && Number.isFinite(s.price) && s.price >= 0) {
      const cur = typeof s.currency === 'string' && s.currency.trim() ? s.currency.trim().toUpperCase() : ''
      priceStr = cur ? `${s.price} ${cur}` : String(s.price)
    }
    rows.push({
      rowKey: makeStep5RowKey(),
      name,
      durationMinutes,
      priceStr
    })
    if (rows.length >= 20) break
  }
  return rows
}

/**
 * @param {unknown} data
 * @param {string} rawInputUrl
 */
export function mapPerplexityExtractionToWizard(data, rawInputUrl) {
  const d = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data) : {}
  /** @type {Record<string, boolean>} */
  const hints = {}
  /** @type {Record<string, unknown>} */
  const patch = {}

  const site = normalizeWizardWebsiteUrl(rawInputUrl)
  if (site) {
    patch.profileWebsite = site
    hints.profileWebsite = true
  }

  if (typeof d.name === 'string' && d.name.trim()) {
    patch.businessName = d.name.trim().slice(0, 120)
    hints.businessName = true
  }

  const { category, custom } = mapPerplexityCategoryToSetup(d.category)
  patch.category = category
  hints.category = true
  if (category === 'other' && custom) {
    patch.customCategory = custom.slice(0, 80)
    hints.customCategory = true
  }

  if (typeof d.description === 'string' && d.description.trim()) {
    patch.profileDescription = d.description.trim().slice(0, 500)
    hints.profileDescription = true
  }

  const addr = d.address && typeof d.address === 'object' ? /** @type {Record<string, unknown>} */ (d.address) : null
  if (addr) {
    if (typeof addr.street === 'string' && addr.street.trim()) {
      patch.profileStreet = addr.street.trim().slice(0, 200)
      hints.profileStreet = true
    }
    if (typeof addr.city === 'string' && addr.city.trim()) {
      patch.profileCity = addr.city.trim().slice(0, 120)
      patch.city = addr.city.trim().slice(0, 120)
      hints.profileCity = true
      hints.city = true
    }
    if (typeof addr.region === 'string' && addr.region.trim()) {
      patch.profileProvinceState = addr.region.trim().slice(0, 120)
      hints.profileProvinceState = true
    }
    if (typeof addr.postalCode === 'string' && addr.postalCode.trim()) {
      patch.profilePostalCode = addr.postalCode.trim().slice(0, 32)
      hints.profilePostalCode = true
    }
    if (typeof addr.country === 'string' && addr.country.trim()) {
      const cc = countryLabelToCode(addr.country.trim()) || addr.country.trim().toUpperCase().slice(0, 2)
      if (cc && /^[A-Z]{2}$/.test(cc)) {
        patch.profileCountry = cc
        hints.profileCountry = true
      }
    }
  }

  if (typeof d.phone === 'string' && d.phone.trim()) {
    patch.profileBusinessPhone = d.phone.trim().slice(0, 40)
    hints.profileBusinessPhone = true
  }
  if (typeof d.email === 'string' && d.email.trim()) {
    patch.profilePublicEmail = d.email.trim().slice(0, 120)
    hints.profilePublicEmail = true
  }

  const hours = d.hours && typeof d.hours === 'object' ? /** @type {Record<string, unknown>} */ (d.hours) : null
  if (hours) {
    /** @type {Record<string, Array<{ start: string, end: string }>>} */
    const bh = {}
    let any = false
    for (const day of DAYS) {
      const cell = hours[day]
      const parsed = parseHoursCell(cell)
      if (parsed !== null) {
        bh[day] = parsed
        any = true
      }
    }
    if (any) {
      patch.businessHours = bh
      hints.businessHours = true
    }
  }

  const langs = Array.isArray(d.languages) ? d.languages.filter((x) => typeof x === 'string') : []
  const rawLang = langs[0] ? String(langs[0]).trim().toLowerCase() : ''
  const first = rawLang.split(/[\s,_-]+/)[0] || rawLang
  const langMap = {
    english: 'en',
    en: 'en',
    french: 'fr',
    français: 'fr',
    fr: 'fr',
    spanish: 'es',
    español: 'es',
    es: 'es',
    arabic: 'ar',
    العربية: 'ar',
    ar: 'ar'
  }
  const codeGuess = langMap[first] || (first.length === 2 ? first : '')
  if (codeGuess) {
    patch.primaryLanguage = normalizePrimaryLanguage(codeGuess)
    hints.primaryLanguage = true
  }
  if (langs.length >= 2) {
    patch.multilingualEnabled = true
    hints.multilingualEnabled = true
  }

  const social = d.social && typeof d.social === 'object' ? /** @type {Record<string, unknown>} */ (d.social) : null
  if (social) {
    if (typeof social.instagram === 'string' && social.instagram.trim()) {
      patch.profileSocialInstagram = social.instagram.trim().slice(0, 200)
      hints.profileSocialInstagram = true
    }
    if (typeof social.facebook === 'string' && social.facebook.trim()) {
      patch.profileSocialFacebook = social.facebook.trim().slice(0, 200)
      hints.profileSocialFacebook = true
    }
    if (typeof social.tiktok === 'string' && social.tiktok.trim()) {
      patch.profileSocialTiktok = social.tiktok.trim().slice(0, 200)
      hints.profileSocialTiktok = true
    }
  }

  const step5Rows = mapServicesToStep5Rows(d.services)
  if (step5Rows.length > 0) hints.services = true

  return { wizardPatch: patch, step5Rows, hints }
}

/**
 * Map infer-profile `profile` object (Haiku path) into wizard patch + hints.
 * @param {unknown} profile
 * @param {string} rawUrl
 */
export function mapInferProfileToWizardPatch(profile, rawUrl) {
  const p = profile && typeof profile === 'object' ? /** @type {Record<string, unknown>} */ (profile) : {}
  /** @type {Record<string, boolean>} */
  const hints = {}
  /** @type {Record<string, unknown>} */
  const patch = {}

  const site = typeof p.websiteUrl === 'string' && p.websiteUrl.trim() ? p.websiteUrl.trim() : normalizeWizardWebsiteUrl(rawUrl)
  if (site) {
    patch.profileWebsite = site
    hints.profileWebsite = true
  }

  if (typeof p.businessName === 'string' && p.businessName.trim()) {
    patch.businessName = p.businessName.trim().slice(0, 120)
    hints.businessName = true
  }

  let cat = String(p.category || 'other').toLowerCase()
  if (cat === 'physio') cat = 'medical'
  if (!SETUP_CATEGORIES.has(cat)) cat = 'other'
  patch.category = cat
  hints.category = true

  if (typeof p.description === 'string' && p.description.trim()) {
    patch.profileDescription = p.description.trim().slice(0, 500)
    hints.profileDescription = true
  }

  const cc = countryLabelToCode(typeof p.country === 'string' ? p.country : '') || 'US'
  patch.profileCountry = cc
  hints.profileCountry = true

  const tz = typeof p.timezone === 'string' && isValidIanaTimeZone(p.timezone) ? p.timezone : null
  if (tz) {
    patch.timezone = tz
    hints.timezone = true
  }

  const lang = typeof p.language === 'string' ? p.language : 'en'
  patch.primaryLanguage = normalizePrimaryLanguage(lang)
  hints.primaryLanguage = true

  const addr = p.address
  if (addr != null && String(addr).trim()) {
    patch.profileStreet = String(addr).trim().slice(0, 240)
    hints.profileStreet = true
  }

  if (p.phoneNumber != null && String(p.phoneNumber).trim()) {
    patch.profileBusinessPhone = String(p.phoneNumber).trim().slice(0, 40)
    hints.profileBusinessPhone = true
  }

  const sample = Array.isArray(p.sampleServices) ? p.sampleServices : []
  const step5Rows = []
  for (const s of sample) {
    if (!s || typeof s !== 'object') continue
    const name = typeof s.name === 'string' ? s.name.trim().slice(0, 120) : ''
    if (!name) continue
    let durationMinutes = 30
    if (typeof s.durationMinutes === 'number' && Number.isFinite(s.durationMinutes)) {
      durationMinutes = Math.max(5, Math.min(480, Math.round(s.durationMinutes)))
    }
    let priceStr = ''
    if (typeof s.priceEstimate === 'number' && Number.isFinite(s.priceEstimate) && s.priceEstimate >= 0) {
      priceStr = String(Math.round(s.priceEstimate))
    }
    step5Rows.push({
      rowKey: makeStep5RowKey(),
      name,
      durationMinutes,
      priceStr
    })
    if (step5Rows.length >= 10) break
  }
  if (step5Rows.length > 0) hints.services = true

  return { wizardPatch: patch, step5Rows, hints }
}
