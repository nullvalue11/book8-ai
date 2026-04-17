/**
 * Pure helpers for Google Places Details → public review cache (BOO-81B / BOO-96B).
 * Kept free of `@/` imports so `node --test` can load this module.
 */

import { asPlaceRecord } from './googlePlaces.js'
import { sortGoogleReviewsForPublicDisplay } from './googleReviewsSort.js'

/**
 * Rating-only or missing snippets — wrong for public footer; legacy Details often fills `reviews`.
 * BOO-96B: if `rating` is present but `reviews` is empty, always treat as partial so legacy fallback runs.
 */
export function isPartialGoogleReviewsPayload(payload) {
  if (!payload || typeof payload !== 'object') return true
  const rating = payload.rating
  const revs = Array.isArray(payload.reviews) ? payload.reviews : []

  if (rating != null && revs.length === 0) return true

  const total = typeof payload.userRatingsTotal === 'number' ? payload.userRatingsTotal : 0
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

function coalesceUserRatingsTotal(result) {
  const raw =
    result.user_ratings_total ??
    result.userRatingCount ??
    result.userRatingsTotal ??
    result.reviewCount
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.floor(raw)
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseInt(String(raw).replace(/[, _]/g, ''), 10)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 0
}

/**
 * @param {unknown} raw — JSON from Places Details (legacy or core-wrapped)
 * @returns {{ rating: number | null, userRatingsTotal: number, reviews: object[], lastFetchedAt: Date } | null}
 */
export function normalizePlacesDetailsToReviewCache(raw) {
  if (!raw || typeof raw !== 'object') return null
  const result = asPlaceRecord(raw)
  if (!result || typeof result !== 'object') return null

  const rating = typeof result.rating === 'number' && result.rating > 0 ? result.rating : null
  const userRatingsTotal = coalesceUserRatingsTotal(result)
  const revs = Array.isArray(result.reviews) ? result.reviews : []
  const mapped = revs.map((r) =>
    mapOneReviewRow(r && typeof r === 'object' ? /** @type {Record<string, unknown>} */ (r) : {})
  )
  const reviews = sortGoogleReviewsForPublicDisplay(mapped).slice(0, 5)

  if (rating == null && reviews.length === 0 && userRatingsTotal === 0) return null

  return {
    rating,
    userRatingsTotal,
    reviews,
    lastFetchedAt: new Date()
  }
}
