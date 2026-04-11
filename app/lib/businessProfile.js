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

/** @param {unknown} logo */
export function normalizeBusinessLogo(logo) {
  if (!logo || typeof logo !== 'object') return null
  const url = trimOrEmpty(/** @type {{ url?: string }} */ (logo).url)
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) return null
  return { url: url.slice(0, 2048) }
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
  if (normalizeBusinessLogo(p.logo)) return true
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
  const logo = normalizeBusinessLogo(p.logo)
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
    weeklyHours: p.weeklyHours && typeof p.weeklyHours === 'object' ? p.weeklyHours : null,
    ...(logo ? { logo } : {})
  }
}

/**
 * Nested address on book8-core-api `businessProfile` → flat fields used in book8-ai UI.
 * @param {Record<string, unknown> | null | undefined} coreBp
 * @returns {Partial<BusinessProfileInput> | null}
 */
export function flatAddressFromCoreBusinessProfile(coreBp) {
  if (!coreBp || typeof coreBp !== 'object') return null
  const addr = coreBp.address
  if (!addr || typeof addr !== 'object') return null
  const streetLine = trimOrEmpty(
    /** @type {{ street?: string, line1?: string }} */ (addr).street ??
      /** @type {{ line1?: string }} */ (addr).line1 ??
      ''
  )
  const street2 = trimOrEmpty(
    /** @type {{ street2?: string, line2?: string }} */ (addr).street2 ??
      /** @type {{ line2?: string }} */ (addr).line2 ??
      ''
  )
  return {
    street: streetLine,
    street2,
    city: trimOrEmpty(addr.city ?? ''),
    provinceState: trimOrEmpty(
      addr.province ?? addr.provinceState ?? /** @type {{ region?: string }} */ (addr).region ?? ''
    ),
    postalCode: trimOrEmpty(addr.postalCode ?? addr.postal_code ?? ''),
    country: trimOrEmpty(addr.country ?? '').toUpperCase() || 'US'
  }
}

/**
 * Merge core-api `businessProfile.address` over local Mongo profile for GET responses.
 */
export function mergeCoreProfileAddressIntoLocal(localProfile, coreBusiness) {
  if (!coreBusiness || typeof coreBusiness !== 'object') return localProfile
  const coreBp = coreBusiness.businessProfile
  if (!coreBp || typeof coreBp !== 'object') return localProfile
  const flat = flatAddressFromCoreBusinessProfile(coreBp)
  if (!flat) return localProfile
  const base = localProfile && typeof localProfile === 'object' ? { ...localProfile } : {}
  const hasAny =
    trimOrEmpty(flat.street) ||
    trimOrEmpty(flat.city) ||
    trimOrEmpty(flat.provinceState) ||
    trimOrEmpty(flat.postalCode) ||
    (flat.country && flat.country !== 'US')
  if (hasAny) Object.assign(base, flat)
  return base
}

/**
 * Build `businessProfile` JSON for PATCH /api/businesses/:id/profile (nested address + optional fields).
 * @param {BusinessProfileInput} mergedProfile
 * @returns {Record<string, unknown>}
 */
export function mergedLocalProfileToCoreBusinessProfileBody(mergedProfile) {
  const p = mergedProfile && typeof mergedProfile === 'object' ? mergedProfile : {}
  const street = trimOrEmpty(p.street)
  const street2 = trimOrEmpty(p.street2)
  const city = trimOrEmpty(p.city)
  const province = trimOrEmpty(p.provinceState)
  const postalCode = trimOrEmpty(p.postalCode)
  const country = trimOrEmpty(p.country).toUpperCase() || 'US'
  const streetCombined = [street, street2].filter(Boolean).join(', ')
  const formattedParts = [street, street2, city, province, postalCode, country].filter(Boolean)
  const formattedLine = formattedParts.length ? formattedParts.join(', ') : ''

  /** @type {Record<string, string>} */
  const address = {}
  if (streetCombined) address.street = streetCombined
  if (city) address.city = city
  if (province) address.province = province
  if (postalCode) address.postalCode = postalCode
  if (country) address.country = country
  if (formattedLine) address.formattedLine = formattedLine

  /** @type {Record<string, unknown>} */
  const businessProfile = {}
  if (Object.keys(address).length > 0) {
    businessProfile.address = address
  }

  const phone = trimOrEmpty(p.phone)
  const email = trimOrEmpty(p.email)
  const description = trimOrEmpty(p.description)
  const website = trimOrEmpty(p.website)
  if (phone) businessProfile.phone = phone
  if (email) businessProfile.email = email
  if (description) businessProfile.description = description
  if (website) businessProfile.website = website

  if (p.social && typeof p.social === 'object') {
    businessProfile.social = p.social
  }
  if (p.weeklyHours && typeof p.weeklyHours === 'object') {
    businessProfile.weeklyHours = p.weeklyHours
  }

  return businessProfile
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

export function formatHoursRange(segments, closedWord = 'Closed') {
  if (!Array.isArray(segments) || segments.length === 0) return closedWord
  return segments.map((s) => `${s.start}–${s.end}`).join(', ')
}

/**
 * @param {Record<string, unknown> | null | undefined} weeklyHours
 * @param {string} todayKey
 * @param {{ dayLabels?: Record<string, string>, closedLabel?: string }} [opts]
 */
export function weeklyHoursForDisplay(weeklyHours, todayKey, opts = {}) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return { today: null, week: [] }
  const dayLabels = opts.dayLabels && typeof opts.dayLabels === 'object' ? opts.dayLabels : null
  const labelFor = (key) => (dayLabels && dayLabels[key]) || DAY_LABEL[key]
  const closedWord = opts.closedLabel != null ? opts.closedLabel : 'Closed'
  const week = DAY_ORDER.map((key) => {
    const segs = weeklyHours[key]
    const isClosed = !Array.isArray(segs) || segs.length === 0
    return {
      key,
      label: labelFor(key),
      text: formatHoursRange(segs, closedWord),
      isClosed
    }
  })
  const today = weeklyHours[todayKey]
  const todayClosed = !Array.isArray(today) || today.length === 0
  return {
    today: today
      ? { label: labelFor(todayKey), text: formatHoursRange(today, closedWord), isClosed: todayClosed }
      : null,
    week
  }
}
