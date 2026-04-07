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
  const reviews = revs.slice(0, 5).map((r) => {
    const x = r && typeof r === 'object' ? /** @type {Record<string, unknown>} */ (r) : {}
    const authorName = typeof x.author_name === 'string' ? x.author_name : ''
    const ratingN = typeof x.rating === 'number' ? x.rating : 0
    const text = typeof x.text === 'string' ? x.text : ''
    const time = typeof x.time === 'number' ? x.time : 0
    const relativeTimeDescription =
      typeof x.relative_time_description === 'string' ? x.relative_time_description : ''
    const profilePhotoUrl = typeof x.profile_photo_url === 'string' ? x.profile_photo_url : ''
    return {
      authorName,
      rating: ratingN,
      text,
      time,
      relativeTimeDescription,
      profilePhotoUrl
    }
  })

  if (rating == null && reviews.length === 0) return null

  return {
    rating,
    userRatingsTotal,
    reviews,
    lastFetchedAt: new Date()
  }
}

/**
 * @param {string} placeId
 * @returns {Promise<{ rating: number | null, userRatingsTotal: number, reviews: object[], lastFetchedAt: Date } | null>}
 */
export async function fetchFreshGoogleReviewsForPlaceId(placeId) {
  const pid = String(placeId || '').trim()
  if (!pid) return null

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
        if (normalized) return normalized
      }
    } catch {
      /* fall through */
    }
  }

  const key = env.GOOGLE_MAPS_API_KEY && String(env.GOOGLE_MAPS_API_KEY).trim()
  if (!key) return null

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
      return null
    }
    return normalizePlacesDetailsToReviewCache(data)
  } catch (e) {
    console.warn('[google-reviews] fetch failed', e?.message || e)
    return null
  }
}

export function cacheIsFresh(cache) {
  if (!cache || typeof cache !== 'object') return false
  const hasPayload = cache.rating != null || (Array.isArray(cache.reviews) && cache.reviews.length > 0)
  if (!hasPayload) return false
  const t = cache.lastFetchedAt
  const ms = t instanceof Date ? t.getTime() : typeof t === 'string' || typeof t === 'number' ? new Date(t).getTime() : NaN
  if (!Number.isFinite(ms)) return false
  return Date.now() - ms < ONE_DAY_MS
}

export { ONE_DAY_MS }
