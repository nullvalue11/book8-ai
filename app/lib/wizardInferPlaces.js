/**
 * Google Places enrichment for /api/wizard/infer-profile (BOO-WIZARD-INFER-V2-1B).
 * Uses core-api Places (same path as /api/places/*), never throws — callers fall back to LLM-only.
 */

import { placeDetailsToProfileFields } from '@/lib/googlePlaces'
import {
  corePlacesBaseUrl,
  corePlacesConfigured,
  corePlacesInternalHeaders
} from '@/api/places/_lib/core-places'

const PLACES_FETCH_MS = 12_000
const CACHE_MS = 7 * 24 * 60 * 60 * 1000

const placesCache =
  globalThis.__book8WizardInferPlacesCache ??
  (globalThis.__book8WizardInferPlacesCache = new Map())

/** @param {string} description */
export function detectInputType(description) {
  const t = String(description || '').trim()
  if (!t) return 'businessName'
  const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/.*)?$/i
  if (urlPattern.test(t)) return 'url'
  return 'businessName'
}

/** @param {import('next/server').NextRequest | Request} request */
export function getLocationHintFromRequest(request) {
  const country = request.headers.get('x-vercel-ip-country')
  const cityRaw = request.headers.get('x-vercel-ip-city')
  const region = request.headers.get('x-vercel-ip-country-region')
  if (!country?.trim() && !cityRaw?.trim()) return null
  let city = ''
  if (cityRaw) {
    try {
      city = decodeURIComponent(cityRaw.replace(/\+/g, ' ')).trim()
    } catch {
      city = cityRaw.trim()
    }
  }
  return {
    country: country?.trim() || null,
    city: city || null,
    region: region?.trim() || null
  }
}

export function extractDomainFromInput(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    let u = raw
    if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, '')}`
    const h = new URL(u).hostname.replace(/^www\./i, '')
    return h.toLowerCase()
  } catch {
    return ''
  }
}

export function stringSimilarity(a, b) {
  const x = String(a || '')
    .toLowerCase()
    .trim()
  const y = String(b || '')
    .toLowerCase()
    .trim()
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return 0.88
  const ta = new Set(x.split(/\s+/).filter(Boolean))
  const tb = new Set(y.split(/\s+/).filter(Boolean))
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter += 1
  const union = ta.size + tb.size - inter
  return union ? inter / union : 0
}

/**
 * Map core google category slug → wizard infer categories.
 * @param {string|null|undefined} gCat
 */
export function mapGoogleCategoryToWizard(gCat) {
  if (!gCat || typeof gCat !== 'string') return null
  const c = gCat.toLowerCase()
  if (c === 'clinic' || c === 'medical') return 'physio'
  if (c === 'veterinary' || c === 'restaurant') return 'other'
  const allowed = new Set(['barber', 'dental', 'spa', 'fitness', 'physio', 'other'])
  if (allowed.has(c)) return c
  return null
}

/**
 * @param {unknown} rawDetails
 */
function parsePlacesDetailsForWizard(rawDetails) {
  const inner =
    rawDetails && typeof rawDetails === 'object'
      ? /** @type {Record<string, unknown>} */ (rawDetails).result &&
        typeof /** @type {Record<string, unknown>} */ (rawDetails).result === 'object'
        ? /** @type {Record<string, unknown>} */ (rawDetails).result
        : /** @type {Record<string, unknown>} */ (rawDetails).place &&
            typeof /** @type {Record<string, unknown>} */ (rawDetails).place === 'object'
          ? /** @type {Record<string, unknown>} */ (rawDetails).place
          : rawDetails
      : null
  if (!inner || typeof inner !== 'object') return null

  let displayName = ''
  const dn = /** @type {Record<string, unknown>} */ (inner).displayName
  if (typeof dn === 'string') displayName = dn.trim()
  else if (dn && typeof dn === 'object' && typeof /** @type {{ text?: string }} */ (dn).text === 'string') {
    displayName = /** @type {{ text?: string }} */ (dn).text.trim()
  }
  if (!displayName && typeof inner.name === 'string') {
    const n = inner.name.trim()
    if (n && !n.startsWith('places/')) displayName = n
  }

  const pf = placeDetailsToProfileFields(rawDetails)
  const reviewRaw =
    /** @type {Record<string, unknown>} */ (inner).userRatingCount ??
    /** @type {Record<string, unknown>} */ (inner).user_ratings_total
  const userRatingCount = typeof reviewRaw === 'number' && reviewRaw >= 0 ? Math.floor(reviewRaw) : 0

  const formattedAddress =
    (typeof inner.formattedAddress === 'string' && inner.formattedAddress.trim()) ||
    (typeof inner.formatted_address === 'string' && inner.formatted_address.trim()) ||
    ''

  const websiteUrl =
    (typeof inner.websiteUri === 'string' && inner.websiteUri.trim()) ||
    (typeof inner.website === 'string' && inner.website.trim()) ||
    pf.profile.website ||
    ''

  const phoneNumber = pf.profile.phone || ''

  return {
    displayName: displayName || pf.profile.street || 'Unknown',
    formattedAddress: formattedAddress.slice(0, 500),
    phoneNumber: phoneNumber.slice(0, 40),
    websiteUrl: websiteUrl.slice(0, 2048),
    userRatingCount,
    googleCategory: pf.category,
    placeId: pf.placeId
  }
}

/**
 * @param {string} query
 * @param {{ displayName: string, phoneNumber: string, websiteUrl: string, userRatingCount: number }} match
 * @param {'url'|'businessName'} inputType
 * @param {string} originalInput
 */
export function calculatePlacesConfidence(query, match, inputType, originalInput) {
  let confidence = 0
  const nameSim = stringSimilarity(query, match.displayName)
  confidence += nameSim * 0.5
  if (match.phoneNumber) confidence += 0.15
  if (match.userRatingCount > 5) confidence += 0.2
  if (inputType === 'url' && match.websiteUrl) {
    const d = extractDomainFromInput(originalInput)
    if (d && match.websiteUrl.toLowerCase().includes(d)) confidence += 0.15
  }
  return Math.min(confidence, 1)
}

function cacheGet(key) {
  const row = placesCache.get(key)
  if (!row) return null
  if (Date.now() > row.expiresAt) {
    placesCache.delete(key)
    return null
  }
  return row.detailsRaw
}

function cacheSet(key, detailsRaw) {
  placesCache.set(key, { detailsRaw, expiresAt: Date.now() + CACHE_MS })
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function buildBiasedSearchQuery(businessName, hint) {
  const q = String(businessName || '').trim()
  if (!q) return ''
  if (!hint?.city && !hint?.region) return q
  const parts = [q]
  if (hint.city) parts.push(hint.city)
  else if (hint.region) parts.push(hint.region)
  if (hint.country && !hint.city) parts.push(hint.country)
  return parts.filter(Boolean).join(', ')
}

/**
 * @returns {Promise<unknown|null>}
 */
async function autocompleteThenDetails(searchQuery) {
  const base = corePlacesBaseUrl()
  const autoUrl = new URL(`${base}/api/places/autocomplete`)
  autoUrl.searchParams.set('query', searchQuery)
  autoUrl.searchParams.set('type', 'establishment')

  const autoRes = await fetchWithTimeout(
    autoUrl.toString(),
    { headers: corePlacesInternalHeaders(false), cache: 'no-store' },
    PLACES_FETCH_MS
  )
  if (!autoRes.ok) {
    console.warn('[wizard/infer-places] autocomplete', autoRes.status)
    return null
  }
  const autoData = await autoRes.json().catch(() => ({}))
  let predictions = []
  if (Array.isArray(autoData.predictions)) predictions = autoData.predictions
  else if (Array.isArray(autoData.results)) predictions = autoData.results
  const first = predictions[0]
  if (!first || typeof first !== 'object') return null
  const placeId =
    /** @type {Record<string, unknown>} */ (first).placeId ||
    /** @type {Record<string, unknown>} */ (first).place_id ||
    /** @type {Record<string, unknown>} */ (first).id
  if (typeof placeId !== 'string' || !placeId.trim()) return null

  const detUrl = new URL(`${base}/api/places/details`)
  detUrl.searchParams.set('placeId', placeId.trim())

  const detRes = await fetchWithTimeout(
    detUrl.toString(),
    { headers: corePlacesInternalHeaders(false), cache: 'no-store' },
    PLACES_FETCH_MS
  )
  if (!detRes.ok) {
    console.warn('[wizard/infer-places] details', detRes.status)
    return null
  }
  return detRes.json().catch(() => null)
}

const ALL_LLM_SOURCES = {
  businessName: 'llm',
  address: 'llm',
  phoneNumber: 'llm',
  websiteUrl: 'llm',
  category: 'llm',
  description: 'llm',
  country: 'llm',
  timezone: 'llm',
  language: 'llm',
  sampleServices: 'llm',
  googlePlaceId: 'llm'
}

/**
 * @param {Record<string, unknown>} llmProfile — pre-safeProfile shape ok
 * @param {'url'|'businessName'} inputType
 * @param {string} originalDescription
 * @param {import('next/server').NextRequest | Request} request
 * @param {(url: string, fallback: string) => string} normalizeWebsiteUrl
 */
export async function enrichProfileWithGooglePlaces(
  llmProfile,
  inputType,
  originalDescription,
  request,
  normalizeWebsiteUrl
) {
  const sources = { ...ALL_LLM_SOURCES }
  const out = { ...llmProfile, _dataSources: sources }

  if (!corePlacesConfigured()) {
    return out
  }

  const businessName =
    typeof llmProfile.businessName === 'string' ? llmProfile.businessName.trim() : ''
  if (!businessName) {
    return out
  }

  const cacheKey = businessName.toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
  const hint = getLocationHintFromRequest(request)
  const searchQuery = buildBiasedSearchQuery(businessName, hint)

  let detailsRaw = cacheGet(cacheKey)
  try {
    if (!detailsRaw) {
      detailsRaw = await autocompleteThenDetails(searchQuery)
      if (detailsRaw) cacheSet(cacheKey, detailsRaw)
    }
  } catch (e) {
    console.warn('[wizard/infer-places] search failed', e?.message || e)
    return out
  }

  if (!detailsRaw) return out

  const match = parsePlacesDetailsForWizard(detailsRaw)
  if (!match || !match.placeId) return out

  const confidence = calculatePlacesConfidence(
    businessName,
    {
      displayName: match.displayName,
      phoneNumber: match.phoneNumber,
      websiteUrl: match.websiteUrl,
      userRatingCount: match.userRatingCount
    },
    inputType,
    originalDescription
  )

  if (confidence < 0.7) {
    return out
  }

  /** @type {Record<string, string>} */
  const mergedSources = { ...sources }
  mergedSources.businessName = 'google'
  mergedSources.address = 'google'
  mergedSources.googlePlaceId = 'google'
  if (match.phoneNumber) mergedSources.phoneNumber = 'google'
  if (match.websiteUrl) mergedSources.websiteUrl = 'google'

  const wizardCat = mapGoogleCategoryToWizard(match.googleCategory)
  if (wizardCat) {
    mergedSources.category = 'google'
    out.category = wizardCat
  }

  out.businessName = match.displayName.slice(0, 120)
  if (match.formattedAddress) {
    out.address = match.formattedAddress.slice(0, 240)
  }
  if (match.phoneNumber) {
    out.phoneNumber = match.phoneNumber
  }
  if (match.websiteUrl) {
    out.websiteUrl = normalizeWebsiteUrl(match.websiteUrl, '')
  }
  out.googlePlaceId = match.placeId
  out._dataSources = mergedSources

  return out
}
