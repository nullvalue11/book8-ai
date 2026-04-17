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
import {
  normalizePlacesDetailsToReviewCache,
  isPartialGoogleReviewsPayload
} from '@/lib/googlePlaceReviewsNormalize'

export { normalizePlacesDetailsToReviewCache, isPartialGoogleReviewsPayload }

const ONE_DAY_MS = 24 * 60 * 60 * 1000

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
        if (env.DEBUG_LOGS && raw != null && typeof raw === 'object') {
          console.log('[google-reviews] CORE_RAW_DEBUG', {
            placeId: pid,
            rawKeys: Object.keys(raw),
            rawSample: JSON.stringify(raw).slice(0, 500)
          })
        }
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
