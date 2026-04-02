/**
 * Public booking page profile (stored on business.businessProfile in Mongo).
 */

import { getSubdivisionsForCountry, COUNTRY_OPTIONS } from '@/lib/region-data'

const MAX_DESC = 500
const MAX_FIELD = 200

/** @typedef {{
  street?: string,
  street2?: string,
  city?: string,
  provinceState?: string,
  postalCode?: string,
  country?: string,
  phone?: string,
  email?: string,
  description?: string,
  website?: string,
  social?: { instagram?: string, facebook?: string, tiktok?: string },
  weeklyHours?: Record<string, Array<{ start: string, end: string }>>
}} BusinessProfileInput */

export function emptyBusinessProfile() {
  return {
    street: '',
    street2: '',
    city: '',
    provinceState: '',
    postalCode: '',
    country: 'US',
    phone: '',
    email: '',
    description: '',
    website: '',
    social: { instagram: '', facebook: '', tiktok: '' },
    weeklyHours: null
  }
}

function trimOrEmpty(s) {
  if (s == null || typeof s !== 'string') return ''
  return s.trim()
}

function normalizeUrl(input) {
  const t = trimOrEmpty(input)
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t.slice(0, 2048)
  if (/^\/\//.test(t)) return `https:${t}`.slice(0, 2048)
  return `https://${t}`.slice(0, 2048)
}

function normalizeSocial(val) {
  const t = trimOrEmpty(val)
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t.slice(0, 512)
  const v = t.replace(/^@+/, '')
  return v.slice(0, 200)
}

/**
 * Validates and normalizes profile for storage.
 * @param {Record<string, unknown>} raw
 * @returns {{ ok: true, profile: BusinessProfileInput } | { ok: false, error: string }}
 */
export function parseBusinessProfileBody(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid profile body' }
  }

  const street = trimOrEmpty(raw.street).slice(0, MAX_FIELD)
  const street2 = trimOrEmpty(raw.street2).slice(0, MAX_FIELD)
  const city = trimOrEmpty(raw.city).slice(0, MAX_FIELD)
  let provinceState = trimOrEmpty(raw.provinceState).slice(0, MAX_FIELD)
  const postalCode = trimOrEmpty(raw.postalCode).slice(0, 32)
  let country = trimOrEmpty(raw.country).toUpperCase().slice(0, 8) || 'US'
  if (country === 'OTHER') country = 'US'

  const subdivs = getSubdivisionsForCountry(country)
  if (subdivs.length && provinceState) {
    const upper = provinceState.toUpperCase()
    const ok = subdivs.some((s) => s.code === upper || s.name.toLowerCase() === provinceState.toLowerCase())
    if (ok) {
      const match = subdivs.find((s) => s.code === upper || s.name.toLowerCase() === provinceState.toLowerCase())
      if (match) provinceState = match.code
    }
  }

  const phone = trimOrEmpty(raw.phone).slice(0, 40)
  const email = trimOrEmpty(raw.email).slice(0, 200)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Invalid business email' }
  }

  let description = trimOrEmpty(raw.description)
  if (description.length > MAX_DESC) description = description.slice(0, MAX_DESC)

  let website = trimOrEmpty(raw.website)
  if (website) {
    try {
      website = normalizeUrl(website)
      new URL(website)
    } catch {
      return { ok: false, error: 'Invalid website URL' }
    }
  }

  const socIn = raw.social && typeof raw.social === 'object' ? raw.social : {}
  const social = {
    instagram: normalizeSocial(socIn.instagram),
    facebook: normalizeSocial(socIn.facebook),
    tiktok: normalizeSocial(socIn.tiktok)
  }

  let weeklyHours = null
  if (raw.weeklyHours != null && typeof raw.weeklyHours === 'object') {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const out = {}
    for (const d of days) {
      const seg = raw.weeklyHours[d]
      if (!Array.isArray(seg)) continue
      out[d] = seg
        .filter((x) => x && typeof x.start === 'string' && typeof x.end === 'string')
        .map((x) => ({
          start: String(x.start).slice(0, 8),
          end: String(x.end).slice(0, 8)
        }))
        .slice(0, 3)
    }
    weeklyHours = out
  }

  const profile = {
    street,
    street2,
    city,
    provinceState,
    postalCode,
    country,
    phone,
    email,
    description,
    website: website || '',
    social,
    weeklyHours
  }

  return { ok: true, profile }
}

/**
 * Map stored businessProfile → setup wizard `profile*` fields and optional businessHours.
 */
export function businessProfileToWizardPatch(profile) {
  if (!profile || typeof profile !== 'object') return {}
  const s = profile.social && typeof profile.social === 'object' ? profile.social : {}
  const patch = {
    profileStreet: trimOrEmpty(profile.street),
    profileStreet2: trimOrEmpty(profile.street2),
    profileCity: trimOrEmpty(profile.city),
    profileProvinceState: trimOrEmpty(profile.provinceState),
    profilePostalCode: trimOrEmpty(profile.postalCode),
    profileCountry: trimOrEmpty(profile.country) || 'US',
    profileBusinessPhone: trimOrEmpty(profile.phone),
    profilePublicEmail: trimOrEmpty(profile.email),
    profileDescription: trimOrEmpty(profile.description),
    profileSocialInstagram: trimOrEmpty(s.instagram),
    profileSocialFacebook: trimOrEmpty(s.facebook),
    profileSocialTiktok: trimOrEmpty(s.tiktok)
  }
  if (profile.weeklyHours && typeof profile.weeklyHours === 'object') {
    patch.businessHours = profile.weeklyHours
  }
  return patch
}

/** Whether any public-booking field is filled (hours alone can count). */
export function businessProfileHasPublicDisplay(profile) {
  if (!profile || typeof profile !== 'object') return false
  const p = profile
  const addr =
    trimOrEmpty(p.street) ||
    trimOrEmpty(p.city) ||
    trimOrEmpty(p.provinceState) ||
    trimOrEmpty(p.postalCode)
  const country = trimOrEmpty(p.country)
  if (addr || (country && country !== 'US')) return true
  if (trimOrEmpty(p.phone) || trimOrEmpty(p.email) || trimOrEmpty(p.description) || trimOrEmpty(p.website)) return true
  const soc = p.social || {}
  if (trimOrEmpty(soc.instagram) || trimOrEmpty(soc.facebook) || trimOrEmpty(soc.tiktok)) return true
  if (p.weeklyHours && typeof p.weeklyHours === 'object') {
    for (const segs of Object.values(p.weeklyHours)) {
      if (Array.isArray(segs) && segs.length > 0) return true
    }
  }
  return false
}

/** Strip to safe public JSON for /api/public/services */
export function sanitizeBusinessProfileForPublic(profile) {
  if (!profile || typeof profile !== 'object') return null
  if (!businessProfileHasPublicDisplay(profile)) return null
  const p = profile
  return {
    street: trimOrEmpty(p.street) || null,
    street2: trimOrEmpty(p.street2) || null,
    city: trimOrEmpty(p.city) || null,
    provinceState: trimOrEmpty(p.provinceState) || null,
    postalCode: trimOrEmpty(p.postalCode) || null,
    country: trimOrEmpty(p.country) || null,
    phone: trimOrEmpty(p.phone) || null,
    email: trimOrEmpty(p.email) || null,
    description: trimOrEmpty(p.description) || null,
    website: trimOrEmpty(p.website) || null,
    social: {
      instagram: trimOrEmpty(p.social?.instagram) || null,
      facebook: trimOrEmpty(p.social?.facebook) || null,
      tiktok: trimOrEmpty(p.social?.tiktok) || null
    },
    weeklyHours: p.weeklyHours && typeof p.weeklyHours === 'object' ? p.weeklyHours : null
  }
}

export function formatAddressLines(profile) {
  if (!profile) return []
  const lines = []
  const a = [trimOrEmpty(profile.street), trimOrEmpty(profile.street2)].filter(Boolean)
  if (a.length) lines.push(a.join(', '))
  const cityLine = [
    trimOrEmpty(profile.city),
    [trimOrEmpty(profile.provinceState), trimOrEmpty(profile.postalCode)].filter(Boolean).join(' ')
  ]
    .filter(Boolean)
    .join(', ')
  if (cityLine) lines.push(cityLine)
  const c = trimOrEmpty(profile.country)
  if (c && c !== 'OTHER') {
    const label = COUNTRY_LABEL_BY_CODE[c] || c
    lines.push(label)
  }
  return lines.filter(Boolean)
}

const COUNTRY_LABEL_BY_CODE = Object.fromEntries(COUNTRY_OPTIONS.map((o) => [o.code, o.label]))

export function googleMapsSearchUrl(profile) {
  const lines = formatAddressLines(profile)
  if (lines.length === 0) return null
  const q = lines.join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABEL = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday'
}

/** @param {string} ianaTz */
export function getLocalDayKeyInTimeZone(ianaTz) {
  try {
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: ianaTz || 'UTC', weekday: 'long' })
    const w = fmt.format(now).toLowerCase()
    const map = {
      sunday: 'sunday',
      monday: 'monday',
      tuesday: 'tuesday',
      wednesday: 'wednesday',
      thursday: 'thursday',
      friday: 'friday',
      saturday: 'saturday'
    }
    return map[w] || 'monday'
  } catch {
    const d = new Date().getDay()
    return DAY_ORDER[d] || 'monday'
  }
}

export function formatHoursRange(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return 'Closed'
  return segments.map((s) => `${s.start}–${s.end}`).join(', ')
}

export function weeklyHoursForDisplay(weeklyHours, todayKey) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return { today: null, week: [] }
  const week = DAY_ORDER.map((key) => ({
    key,
    label: DAY_LABEL[key],
    text: formatHoursRange(weeklyHours[key])
  }))
  const today = weeklyHours[todayKey]
  return {
    today: today ? { label: DAY_LABEL[todayKey], text: formatHoursRange(today) } : null,
    week
  }
}
