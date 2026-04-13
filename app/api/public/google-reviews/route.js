/**
 * GET /api/public/google-reviews?handle=slug
 * Cached Google reviews for public booking page (BOO-81B)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'
import {
  fetchFreshGoogleReviewsForPlaceId,
  cacheIsFresh,
  isPartialGoogleReviewsPayload
} from '@/lib/googlePlaceReviewsServer'
import { sortGoogleReviewsForPublicDisplay } from '@/lib/googleReviewsSort'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function publicJson(cache) {
  if (!cache || typeof cache !== 'object') {
    return { rating: null, userRatingsTotal: 0, reviews: [] }
  }
  const raw = Array.isArray(cache.reviews) ? cache.reviews : []
  /** BOO-89B: re-sort cached payloads so deploy takes effect without waiting for cache TTL */
  const reviews = sortGoogleReviewsForPublicDisplay(raw).slice(0, 5)
  return {
    rating: cache.rating ?? null,
    userRatingsTotal: typeof cache.userRatingsTotal === 'number' ? cache.userRatingsTotal : 0,
    reviews
  }
}

/**
 * When there is no `placeId` (or Places Details failed), still show stars/count from
 * `business.googlePlaces` if onboarding/sync stored them — otherwise the footer block is empty.
 */
function embeddedGoogleSummaryFromBusiness(business) {
  const g = business?.googlePlaces
  if (!g || typeof g !== 'object') return null
  const rating = typeof g.rating === 'number' && g.rating > 0 ? g.rating : null
  const totalRaw = g.reviewCount ?? g.userRatingCount ?? g.user_ratings_total ?? g.userRatingsTotal
  const userRatingsTotal = typeof totalRaw === 'number' && totalRaw >= 0 ? Math.floor(totalRaw) : 0
  if (rating == null && userRatingsTotal === 0) return null
  return {
    rating,
    userRatingsTotal,
    reviews: [],
    lastFetchedAt: new Date()
  }
}

function googleMapsUrlFromBusiness(business) {
  const g = business?.googlePlaces
  if (!g || typeof g !== 'object') return null
  const u = g.googleMapsUrl || g.url
  if (typeof u === 'string' && /^https:\/\//i.test(u)) return u.slice(0, 2048)
  return null
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = (url.searchParams.get('handle') || '').trim()
    const forceRefresh =
      url.searchParams.get('forceRefresh') === 'true' || url.searchParams.get('forceRefresh') === '1'
    if (!handle) {
      return NextResponse.json({ ok: false, error: 'handle required' }, { status: 400 })
    }

    const database = await connect()
    const coll = database.collection(COLLECTION_NAME)
    const business = await findBusinessByPublicHandle(coll, handle)

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const placeId =
      (typeof business.googlePlaceId === 'string' && business.googlePlaceId.trim()) ||
      (business.googlePlaces &&
        typeof business.googlePlaces === 'object' &&
        typeof business.googlePlaces.placeId === 'string' &&
        business.googlePlaces.placeId.trim()) ||
      ''

    const embedded = embeddedGoogleSummaryFromBusiness(business)
    const mapsUrl = googleMapsUrlFromBusiness(business)

    if (!placeId) {
      const payload = embedded ? publicJson(embedded) : publicJson(null)
      return NextResponse.json({ ok: true, ...payload, googleMapsUrl: mapsUrl })
    }

    const cached = business.googleReviewsCache
    if (!forceRefresh && cacheIsFresh(cached)) {
      return NextResponse.json({ ok: true, ...publicJson(cached), googleMapsUrl: mapsUrl })
    }

    const fresh = await fetchFreshGoogleReviewsForPlaceId(placeId)

    if (fresh) {
      if (!isPartialGoogleReviewsPayload(fresh)) {
        await coll.updateOne(
          { businessId: business.businessId },
          { $set: { googleReviewsCache: fresh, updatedAt: new Date() } }
        )
      }
      return NextResponse.json({ ok: true, ...publicJson(fresh), googleMapsUrl: mapsUrl })
    }

    if (!forceRefresh && cached && !isPartialGoogleReviewsPayload(cached)) {
      return NextResponse.json({ ok: true, ...publicJson(cached), googleMapsUrl: mapsUrl })
    }

    const fallbackPayload = embedded ? publicJson(embedded) : publicJson(null)
    return NextResponse.json({ ok: true, ...fallbackPayload, googleMapsUrl: mapsUrl })
  } catch (e) {
    console.error('[public/google-reviews]', e)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
