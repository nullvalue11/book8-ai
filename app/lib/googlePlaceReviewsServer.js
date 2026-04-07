/**
 * Server-only: normalize Google Places Details payloads and fetch review lists.
 * BOO-81B — used by /api/public/google-reviews
 */

import { env } from '@/lib/env'
import {
  corePlacesBaseUrl,
  corePlacesConfigured,
  corePlacesInternalHeaders
} from '@/api/places/_lib/core-places'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Rating-only payload (no review count / no snippets) — wrong for BOO-82B: core often returns this
 * while legacy Details with `fields=rating,user_ratings_total,reviews` returns full data.
 */
export function isPartialGoogleReviewsPayload(payload) {
  if (!payload || typeof payload !== 'object') return true
  const rating = payload.rating
  const total = typeof payload.userRatingsTotal === 'number' ? payload.userRatingsTotal : 0
  const revs = Array.isArray(payload.reviews) ? payload.reviews : []
  if (rating == null) return revs.length === 0 && total === 0
  if (total > 0) return false
  if (revs.length > 0) return false
  return true
}

/**
 * @param {Record<string, unknown>} x — one review from legacy or Places API (New)-shaped payload
 */
function mapOneReviewRow(x) {
  const o = x && typeof x === 'object' ? x : {}
  let authorName =
    typeof o.author_name === 'string'
      ? o.author_name
      : typeof o.authorName === 'string'
        ? o.authorName
        : ''
  if (!authorName && o.authorAttribution && typeof o.authorAttribution === 'object') {
    const d = /** @type {Record<string, unknown>} */ (o.authorAttribution).displayName
    if (typeof d === 'string') authorName = d
  }

  let text = typeof o.text === 'string' ? o.text : ''
  if (!text && o.text && typeof o.text === 'object') {
    const inner = /** @type {Record<string, unknown>} */ (o.text).text
    if (typeof inner === 'string') text = inner
  }

  let time = typeof o.time === 'number' ? o.time : 0
  if (!time && typeof o.publishTime === 'string') {
    const t = Date.parse(o.publishTime)
    if (!Number.isNaN(t)) time = Math.floor(t / 1000)
  }

  const relativeTimeDescription =
    typeof o.relative_time_description === 'string'
      ? o.relative_time_description
      : typeof o.relativeTimeDescription === 'string'
        ? o.relativeTimeDescription
        : typeof o.relativePublishTimeDescription === 'string'
          ? o.relativePublishTimeDescription
          : ''

  let profilePhotoUrl =
    typeof o.profile_photo_url === 'string'
      ? o.profile_photo_url
      : typeof o.profilePhotoUrl === 'string'
        ? o.profilePhotoUrl
        : ''
  if (!profilePhotoUrl && o.authorAttribution && typeof o.authorAttribution === 'object') {
    const uri = /** @type {Record<string, unknown>} */ (o.authorAttribution).photoUri
    if (typeof uri === 'string') profilePhotoUrl = uri
  }

  const ratingN = typeof o.rating === 'number' ? o.rating : 0
  return {
    authorName,
    rating: ratingN,
    text,
    time,
    relativeTimeDescription,
    profilePhotoUrl
  }
}

/**
 * @param {unknown} raw — JSON from Places Details (legacy or core-wrapped)
 * @returns {{ rating: number | null, userRatingsTotal: number, reviews: object[], lastFetchedAt: Date } | null}
 */
export function normalizePlacesDetailsToReviewCache(raw) {
  if (!raw || typeof raw !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (raw)
  const result =
    (o.result && typeof o.result === 'object' ? /** @type {Record<string, unknown>} */ (o.result) : null) ||
    (o.place && typeof o.place === 'object' ? /** @type {Record<string, unknown>} */ (o.place) : null) ||
    o

  if (!result || typeof result !== 'object') return null

  const rating = typeof result.rating === 'number' && result.rating > 0 ? result.rating : null
  const totalRaw = result.user_ratings_total ?? result.userRatingCount
  const userRatingsTotal = typeof totalRaw === 'number' && totalRaw >= 0 ? Math.floor(totalRaw) : 0
  const revs = Array.isArray(result.reviews) ? result.reviews : []
  const reviews = revs.slice(0, 5).map((r) =>
    mapOneReviewRow(r && typeof r === 'object' ? /** @type {Record<string, unknown>} */ (r) : {})
  )

  if (rating == null && reviews.length === 0 && userRatingsTotal === 0) return null

  const out = {
    rating,
    userRatingsTotal,
    reviews,
    lastFetchedAt: new Date()
  }

  return out
}

/**
 * @param {string} placeId
 * @returns {Promise<{ rating: number | null, userRatingsTotal: number, reviews: object[], lastFetchedAt: Date } | null>}
 */
export async function fetchFreshGoogleReviewsForPlaceId(placeId) {
  const pid = String(placeId || '').trim()
  if (!pid) return null

  /** @type {{ rating: number | null, userRatingsTotal: number, reviews: object[], lastFetchedAt: Date } | null} */
  let partialFallback = null

  if (corePlacesConfigured()) {
    try {
      const detUrl = new URL(`${corePlacesBaseUrl()}/api/places/details`)
      detUrl.searchParams.set('placeId', pid)
      const detRes = await fetch(detUrl.toString(), {
        headers: corePlacesInternalHeaders(false),
        cache: 'no-store'
      })
      if (detRes.ok) {
        const raw = await detRes.json().catch(() => null)
        const normalized = normalizePlacesDetailsToReviewCache(raw)
        if (normalized && !isPartialGoogleReviewsPayload(normalized)) return normalized
        if (normalized && isPartialGoogleReviewsPayload(normalized)) partialFallback = normalized
      }
    } catch {
      /* fall through */
    }
  }

  const key = env.GOOGLE_MAPS_API_KEY && String(env.GOOGLE_MAPS_API_KEY).trim()
  if (key) {
    try {
      const u = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      u.searchParams.set('place_id', pid)
      u.searchParams.set('fields', 'rating,user_ratings_total,reviews')
      u.searchParams.set('key', key)
      const res = await fetch(u.toString(), { cache: 'no-store' })
      const data = await res.json().catch(() => null)
      if (!data || data.status !== 'OK') {
        if (data?.status && data.status !== 'ZERO_RESULTS') {
          console.warn('[google-reviews] Places API:', data.status)
        }
      } else {
        const normalized = normalizePlacesDetailsToReviewCache(data)
        if (normalized && !isPartialGoogleReviewsPayload(normalized)) return normalized
        if (normalized && isPartialGoogleReviewsPayload(normalized) && !partialFallback) partialFallback = normalized
      }
    } catch (e) {
      console.warn('[google-reviews] fetch failed', e?.message || e)
    }
  }

  return partialFallback
}

export function cacheIsFresh(cache) {
  if (!cache || typeof cache !== 'object') return false
  if (isPartialGoogleReviewsPayload(cache)) return false
  const hasPayload = cache.rating != null || (Array.isArray(cache.reviews) && cache.reviews.length > 0)
  if (!hasPayload) return false
  const t = cache.lastFetchedAt
  const ms = t instanceof Date ? t.getTime() : typeof t === 'string' || typeof t === 'number' ? new Date(t).getTime() : NaN
  if (!Number.isFinite(ms)) return false
  return Date.now() - ms < ONE_DAY_MS
}

export { ONE_DAY_MS }
