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
  return o.result && typeof o.result === 'object'
    ? /** @type {Record<string, unknown>} */ (o.result)
    : o.place && typeof o.place === 'object'
      ? /** @type {Record<string, unknown>} */ (o.place)
      : o
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
  const t = types.map((x) => String(x).toLowerCase())
  if (t.some((x) => x.includes('hair') || x === 'barber_shop' || x === 'beauty_salon')) return 'barber'
  if (t.some((x) => x.includes('spa') || x === 'massage')) return 'spa'
  if (t.some((x) => x.includes('dent'))) return 'dental'
  if (t.some((x) => x.includes('gym') || x === 'fitness_center')) return 'fitness'
  if (t.some((x) => x.includes('doctor') || x.includes('physician') || x.includes('hospital') || x === 'health'))
    return 'medical'
  if (t.some((x) => x.includes('restaurant') || x === 'food' || x === 'cafe')) return 'restaurant'
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
  if (!data) return { profile: {}, weeklyHours: null, category: null }

  let category = mapGoogleTypesToCategory(
    Array.isArray(data.types) ? /** @type {string[]} */ (data.types) : []
  )

  const openingHours =
    data.regularOpeningHours ||
    data.openingHours ||
    data.currentOpeningHours ||
    data.opening_hours
  const weeklyHours = googleOpeningHoursToWeeklyHours(openingHours)

  const components = Array.isArray(data.addressComponents)
    ? data.addressComponents
    : Array.isArray(data.address_components)
      ? data.address_components
      : []

  /** @type {Record<string, string>} */
  const typesToVal = {}
  for (const c of components) {
    if (!c || typeof c !== 'object') continue
    const longName = /** @type {Record<string, unknown>} */ (c).longText || /** @type {Record<string, unknown>} */ (c).long_name
    const types = /** @type {Record<string, unknown>} */ (c).types
    if (typeof longName !== 'string' || !Array.isArray(types)) continue
    for (const ty of types) {
      if (typeof ty === 'string') typesToVal[ty] = longName
    }
  }

  const streetNumber = typesToVal.street_number || ''
  const route = typesToVal.route || ''
  const street = [streetNumber, route].filter(Boolean).join(' ').trim()
  const city = typesToVal.locality || typesToVal.postal_town || typesToVal.sublocality || ''
  const provinceState = typesToVal.administrative_area_level_1 || ''
  const postalCode = typesToVal.postal_code || ''
  let country = (typesToVal.country || '').length === 2 ? typesToVal.country.toUpperCase() : ''

  const formatted =
    typeof data.formattedAddress === 'string'
      ? data.formattedAddress
      : typeof data.formatted_address === 'string'
        ? data.formatted_address
        : ''
  const intlPhone =
    typeof data.internationalPhoneNumber === 'string'
      ? data.internationalPhoneNumber.trim()
      : typeof data.international_phone_number === 'string'
        ? data.international_phone_number.trim()
        : ''
  const website =
    typeof data.websiteUri === 'string'
      ? data.websiteUri.trim()
      : typeof data.website === 'string'
        ? data.website.trim()
        : ''

  const profile = {}
  if (street) profile.street = street.slice(0, 200)
  if (city) profile.city = city.slice(0, 200)
  if (provinceState) profile.provinceState = provinceState.slice(0, 200)
  if (postalCode) profile.postalCode = postalCode.slice(0, 32)
  if (country) profile.country = country
  if (intlPhone) profile.phone = intlPhone.slice(0, 40)
  if (website) profile.website = website.slice(0, 2048)

  if (!profile.street && formatted) {
    profile.street = formatted.slice(0, 200)
  }

  return { profile, weeklyHours, category }
}
