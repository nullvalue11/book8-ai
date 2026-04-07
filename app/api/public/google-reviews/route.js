/**
 * GET /api/public/google-reviews?handle=slug
 * Cached Google reviews for public booking page (BOO-81B)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'
import { fetchFreshGoogleReviewsForPlaceId, cacheIsFresh } from '@/lib/googlePlaceReviewsServer'

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
  return {
    rating: cache.rating ?? null,
    userRatingsTotal: typeof cache.userRatingsTotal === 'number' ? cache.userRatingsTotal : 0,
    reviews: Array.isArray(cache.reviews) ? cache.reviews : []
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = (url.searchParams.get('handle') || '').trim()
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

    if (!placeId) {
      return NextResponse.json({ ok: true, ...publicJson(null) })
    }

    const cached = business.googleReviewsCache
    if (cacheIsFresh(cached) && cached && Array.isArray(cached.reviews)) {
      return NextResponse.json({ ok: true, ...publicJson(cached) })
    }

    const fresh = await fetchFreshGoogleReviewsForPlaceId(placeId)

    if (fresh) {
      await coll.updateOne(
        { businessId: business.businessId },
        { $set: { googleReviewsCache: fresh, updatedAt: new Date() } }
      )
      return NextResponse.json({ ok: true, ...publicJson(fresh) })
    }

    if (cached && (cached.rating != null || (Array.isArray(cached.reviews) && cached.reviews.length > 0))) {
      return NextResponse.json({ ok: true, ...publicJson(cached) })
    }

    return NextResponse.json({ ok: true, ...publicJson(null) })
  } catch (e) {
    console.error('[public/google-reviews]', e)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}
