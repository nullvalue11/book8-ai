/**
 * Google Places helpers: normalize API payloads and public-safe subsets.
 */

const MAX_PHOTOS_PUBLIC = 5

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown> | null}
 */
function asPlaceRecord(raw) {
  if (!raw || typeof raw !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (raw)
  if (o.payload && typeof o.payload === 'object') {
    return asPlaceRecord(o.payload)
  }
  if (o.data && typeof o.data === 'object') {
    return asPlaceRecord(o.data)
  }
  if (o.result && typeof o.result === 'object') {
    return /** @type {Record<string, unknown>} */ (o.result)
  }
  if (o.place && typeof o.place === 'object') {
    return /** @type {Record<string, unknown>} */ (o.place)
  }
  if (o.details && typeof o.details === 'object') {
    return /** @type {Record<string, unknown>} */ (o.details)
  }
  return o
}

function trimStr(v) {
  if (v == null || typeof v !== 'string') return ''
  return v.trim()
}

/**
 * Nested address objects from core / Places API (New) style payloads.
 * @param {unknown} addr
 */
function profileFieldsFromNestedAddress(addr) {
  if (!addr || typeof addr !== 'object') {
    return { street: '', street2: '', city: '', provinceState: '', postalCode: '', country: '' }
  }
  const a = /** @type {Record<string, unknown>} */ (addr)
  const lines = Array.isArray(a.lines) ? a.lines.filter((x) => typeof x === 'string') : []
  const line0 = lines[0] ? trimStr(lines[0]) : ''
  const line1 = lines[1] ? trimStr(lines[1]) : ''
  const street =
    trimStr(a.street) ||
    trimStr(a.streetAddress) ||
    [trimStr(a.streetNumber), trimStr(a.route || a.thoroughfare)].filter(Boolean).join(' ').trim() ||
    line0
  const street2 =
    trimStr(a.subpremise) ||
    trimStr(a.suite) ||
    trimStr(a.unit) ||
    trimStr(a.addressLine2) ||
    trimStr(a.line2) ||
    line1
  const city =
    trimStr(a.city) ||
    trimStr(a.locality) ||
    trimStr(a.town) ||
    trimStr(a.district)
  const provinceState =
    trimStr(a.province) ||
    trimStr(a.administrativeArea) ||
    trimStr(a.administrative_area_level_1) ||
    trimStr(a.region) ||
    trimStr(a.state)
  const postalCode =
    trimStr(a.postalCode) || trimStr(a.postal_code) || trimStr(a.zipCode) || trimStr(a.zip)
  let country =
    trimStr(a.countryCode) ||
    trimStr(a.country_code) ||
    trimStr(a.regionCode) ||
    ''
  if (country.length !== 2) {
    const c = trimStr(a.country)
    country = c.length === 2 ? c.toUpperCase() : ''
  } else {
    country = country.toUpperCase()
  }

  return { street, street2, city, provinceState, postalCode, country }
}

/**
 * Strip to safe JSON for public booking page (no API secrets).
 * @param {unknown} raw
 */
export function sanitizeGooglePlacesForPublic(raw) {
  if (!raw || typeof raw !== 'object') return null
  const p = /** @type {Record<string, unknown>} */ (raw)
  const displayName = typeof p.displayName === 'string' ? p.displayName.trim().slice(0, 200) : null
  const rating = typeof p.rating === 'number' && p.rating > 0 ? p.rating : null
  const reviewCountRaw = p.reviewCount ?? p.userRatingCount ?? p.user_ratings_total
  const reviewCount =
    typeof reviewCountRaw === 'number' && reviewCountRaw >= 0 ? Math.floor(reviewCountRaw) : null
  const googleMapsUrl =
    typeof p.googleMapsUrl === 'string' && /^https:\/\//i.test(p.googleMapsUrl)
      ? p.googleMapsUrl.slice(0, 2048)
      : typeof p.url === 'string' && /^https:\/\//i.test(p.url)
        ? p.url.slice(0, 2048)
        : null
  let lat = null
  let lng = null
  const loc = p.location && typeof p.location === 'object' ? /** @type {Record<string, unknown>} */ (p.location) : null
  if (loc) {
    const la = loc.lat ?? loc.latitude
    const ln = loc.lng ?? loc.longitude
    if (typeof la === 'number' && typeof ln === 'number') {
      lat = la
      lng = ln
    }
  }
  const geometry = p.geometry && typeof p.geometry === 'object' ? /** @type {Record<string, unknown>} */ (p.geometry) : null
  const gLoc = geometry?.location && typeof geometry.location === 'object' ? geometry.location : null
  if (lat == null && gLoc && typeof gLoc.lat === 'number' && typeof gLoc.lng === 'number') {
    lat = gLoc.lat
    lng = gLoc.lng
  }
  const formattedAddress =
    typeof p.formattedAddress === 'string'
      ? p.formattedAddress.trim().slice(0, 500)
      : typeof p.formatted_address === 'string'
        ? p.formatted_address.trim().slice(0, 500)
        : null

  /** @type {Array<{ reference: string }>} */
  const photos = []
  if (Array.isArray(p.photos)) {
    for (const ph of p.photos.slice(0, MAX_PHOTOS_PUBLIC)) {
      if (!ph || typeof ph !== 'object') continue
      const ref =
        /** @type {Record<string, unknown>} */ (ph).reference ||
        /** @type {Record<string, unknown>} */ (ph).photoReference ||
        /** @type {Record<string, unknown>} */ (ph).name
      if (typeof ref === 'string' && ref.trim()) {
        photos.push({ reference: ref.trim().slice(0, 512) })
      }
    }
  }

  const placeId = typeof p.placeId === 'string' ? p.placeId.slice(0, 256) : null
  if (
    !displayName &&
    rating == null &&
    !googleMapsUrl &&
    lat == null &&
    photos.length === 0 &&
    !formattedAddress
  ) {
    return null
  }

  return {
    ...(placeId ? { placeId } : {}),
    ...(displayName ? { displayName } : {}),
    ...(rating != null ? { rating } : {}),
    ...(reviewCount != null ? { reviewCount } : {}),
    ...(googleMapsUrl ? { googleMapsUrl } : {}),
    ...(lat != null && lng != null ? { location: { lat, lng } } : {}),
    ...(formattedAddress ? { formattedAddress } : {}),
    ...(photos.length ? { photos } : {})
  }
}

/**
 * Build storable googlePlaces + wizard patches from a Places details payload (flexible shapes).
 * @param {unknown} rawDetails — JSON from /api/places/details
 */
export function placeDetailsToStoredGooglePlaces(rawDetails) {
  const data = asPlaceRecord(rawDetails)
  if (!data) return null
  const pid =
    (typeof data.placeId === 'string' && data.placeId) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof data.name === 'string' && data.name.startsWith('places/') ? data.name : '')
  return sanitizeGooglePlacesForPublic({ ...data, ...(pid ? { placeId: pid } : {}) })
}

/**
 * @param {string[]} types
 * @returns {'barber'|'dental'|'spa'|'fitness'|'medical'|'restaurant'|'other'|null}
 */
export function mapGoogleTypesToCategory(types) {
  if (!Array.isArray(types)) return null
  const t = types.map((x) => String(x).toLowerCase().replace(/\s+/g, '_'))
  if (t.some((x) => x.includes('veterinary') || x === 'veterinary_care')) return 'veterinary'
  if (t.some((x) => x.includes('hair') || x === 'barber_shop' || x === 'beauty_salon' || x === 'hair_care'))
    return 'barber'
  if (t.some((x) => x.includes('spa') || x === 'massage' || x.includes('salon'))) return 'spa'
  if (t.some((x) => x.includes('dent'))) return 'dental'
  if (t.some((x) => x.includes('gym') || x === 'fitness_center' || x.includes('fitness'))) return 'fitness'
  if (t.some((x) => x.includes('doctor') || x.includes('physician') || x.includes('hospital') || x === 'health'))
    return 'clinic'
  return null
}

/**
 * Rough IANA timezone from country + region (no lat/lng API call).
 * @param {string} country ISO-2
 * @param {string} provinceState region code or name
 * @returns {string | null}
 */
export function guessTimezoneFromRegion(country, provinceState) {
  const c = (country || '').toUpperCase().slice(0, 2)
  const p = (provinceState || '').toUpperCase().replace(/\s+/g, '_')
  const p2 = p.length > 2 ? p.slice(0, 2) : p
  if (c === 'CA') {
    if (['BC', 'YT'].includes(p2)) return 'America/Vancouver'
    if (['AB', 'NT', 'NU'].includes(p2)) return 'America/Edmonton'
    if (p2 === 'SK') return 'America/Regina'
    if (p2 === 'MB') return 'America/Winnipeg'
    if (['NB', 'NS', 'PE', 'NL'].includes(p2)) return 'America/Halifax'
    if (p2 === 'QC') return 'America/Toronto'
    return 'America/Toronto'
  }
  if (c === 'US') {
    const pacific = ['CA', 'WA', 'OR', 'NV']
    const mountain = ['MT', 'ID', 'WY', 'UT', 'CO', 'NM', 'AZ']
    const central = [
      'TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'MN', 'IA', 'MO', 'AR', 'LA', 'WI', 'IL', 'MS', 'AL', 'TN'
    ]
    if (pacific.includes(p2)) return 'America/Los_Angeles'
    if (mountain.includes(p2)) return 'America/Denver'
    if (central.includes(p2)) return 'America/Chicago'
    return 'America/New_York'
  }
  if (c === 'GB') return 'Europe/London'
  if (c === 'AU') return 'Australia/Sydney'
  if (c === 'FR') return 'Europe/Paris'
  if (c === 'DE') return 'Europe/Berlin'
  if (c === 'ES') return 'Europe/Madrid'
  if (c === 'JP') return 'Asia/Tokyo'
  return null
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function padTime(t) {
  const s = String(t || '').replace(/\D/g, '').slice(0, 4)
  if (s.length < 4) return null
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}

/**
 * Map Google opening_hours.periods (legacy) to Book8 weeklyHours.
 * @param {unknown} openingHours
 */
export function googleOpeningHoursToWeeklyHours(openingHours) {
  if (!openingHours || typeof openingHours !== 'object') return null
  const periods = /** @type {Record<string, unknown>} */ (openingHours).periods
  if (!Array.isArray(periods) || periods.length === 0) return null
  /** @type {Record<string, Array<{ start: string, end: string }>>} */
  const out = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  }
  for (const per of periods) {
    if (!per || typeof per !== 'object') continue
    const open = /** @type {Record<string, unknown>} */ (per).open
    const close = /** @type {Record<string, unknown>} */ (per).close
    if (!open || typeof open !== 'object') continue
    const day = typeof open.day === 'number' && open.day >= 0 && open.day <= 6 ? open.day : null
    if (day == null) continue
    const key = DAY_KEYS[day]
    const start = padTime(open.time)
    const end = close && typeof close === 'object' ? padTime(/** @type {Record<string, unknown>} */ (close).time) : null
    if (start && end) out[key].push({ start, end })
  }
  return out
}

/**
 * Address + profile fields from Google address_components or formatted line.
 * @param {unknown} rawDetails
 */
export function placeDetailsToProfileFields(rawDetails) {
  const data = asPlaceRecord(rawDetails)
  if (!data) return { profile: {}, weeklyHours: null, category: null, timezoneGuess: null, placeId: null }

  /** @type {string[]} */
  const typeList = Array.isArray(data.types) ? /** @type {string[]} */ (data.types).map(String) : []
  const primaryRaw = data.primaryType ?? data.primary_type
  if (typeof primaryRaw === 'string' && primaryRaw.trim()) {
    typeList.push(primaryRaw.trim())
  }
  let category = mapGoogleTypesToCategory(typeList)

  const openingHours =
    data.regularOpeningHours ||
    data.openingHours ||
    data.currentOpeningHours ||
    data.opening_hours
  const weeklyHours = googleOpeningHoursToWeeklyHours(openingHours)

  const nestedAddr = profileFieldsFromNestedAddress(data.address)

  const components = Array.isArray(data.addressComponents)
    ? data.addressComponents
    : Array.isArray(data.address_components)
      ? data.address_components
      : []

  /** @type {Record<string, string>} */
  const typesToVal = {}
  /** @type {Record<string, string>} */
  const typesShort = {}
  for (const c of components) {
    if (!c || typeof c !== 'object') continue
    const longName = /** @type {Record<string, unknown>} */ (c).longText || /** @type {Record<string, unknown>} */ (c).long_name
    const shortName = /** @type {Record<string, unknown>} */ (c).shortText || /** @type {Record<string, unknown>} */ (c).short_name
    const types = /** @type {Record<string, unknown>} */ (c).types
    if (!Array.isArray(types)) continue
    for (const ty of types) {
      if (typeof ty !== 'string') continue
      if (typeof longName === 'string') typesToVal[ty] = longName
      if (typeof shortName === 'string') typesShort[ty] = shortName
    }
  }

  const streetNumber = typesToVal.street_number || ''
  const route = typesToVal.route || ''
  const subpremise = typesToVal.subpremise || typesToVal.floor || ''
  const cmpStreet = [streetNumber, route].filter(Boolean).join(' ').trim()
  const cmpStreet2 = subpremise
  const cmpCity = typesToVal.locality || typesToVal.postal_town || typesToVal.sublocality || ''
  const cmpProvince =
    typesShort.administrative_area_level_1 ||
    typesToVal.administrative_area_level_1 ||
    ''
  const cmpPostal = typesToVal.postal_code || ''
  let cmpCountry = (typesShort.country || '').toUpperCase()
  if (cmpCountry.length !== 2) {
    cmpCountry = (typesToVal.country || '').length === 2 ? typesToVal.country.toUpperCase() : ''
  }

  const street = nestedAddr.street || cmpStreet
  const street2 = nestedAddr.street2 || cmpStreet2
  const city = nestedAddr.city || cmpCity
  const provinceState = nestedAddr.provinceState || cmpProvince
  const postalCode = nestedAddr.postalCode || cmpPostal
  const country = nestedAddr.country || cmpCountry

  const formatted =
    typeof data.formattedAddress === 'string'
      ? data.formattedAddress
      : typeof data.formatted_address === 'string'
        ? data.formatted_address
        : ''
  const intlPhone =
    trimStr(data.internationalPhoneNumber) ||
    trimStr(data.international_phone_number) ||
    trimStr(data.nationalPhoneNumber) ||
    trimStr(data.national_phone_number) ||
    trimStr(data.formattedPhoneNumber) ||
    trimStr(data.formatted_phone_number) ||
    trimStr(data.phone) ||
    trimStr(data.phoneNumber)
  const website =
    trimStr(data.websiteUri) ||
    trimStr(data.website) ||
    trimStr(data.websiteUrl)

  const profile = {}
  if (street) profile.street = street.slice(0, 200)
  if (street2) profile.street2 = street2.slice(0, 200)
  if (city) profile.city = city.slice(0, 200)
  if (provinceState) profile.provinceState = provinceState.slice(0, 200)
  if (postalCode) profile.postalCode = postalCode.slice(0, 32)
  if (country) profile.country = country.slice(0, 8).toUpperCase()
  if (intlPhone) profile.phone = intlPhone.slice(0, 40)
  if (website) profile.website = website.slice(0, 2048)

  if (!profile.street && formatted) {
    profile.street = formatted.slice(0, 200)
  }

  const timezoneGuess = guessTimezoneFromRegion(country, provinceState) || null

  const placeId =
    (typeof data.place_id === 'string' && data.place_id.trim()) ||
    (typeof data.placeId === 'string' && data.placeId.trim()) ||
    null

  return { profile, weeklyHours, category, timezoneGuess, placeId: placeId || null }
}
