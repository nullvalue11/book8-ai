/**
 * POST: sync Google Places by placeId (proxy core + fallback details, then persist on business).
 * DELETE: remove googlePlaces / googlePlaceId from business.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/auth-utils'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { sanitizeGooglePlacesForPublic, placeDetailsToStoredGooglePlaces } from '@/lib/googlePlaces'
import {
  coverPhotoFromSyncPayload,
  ensureCoverPhotoCached
} from '@/lib/placeCoverPhotoCache'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '@/api/places/_lib/core-places'

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

async function verifyOwner(request, database, businessId) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401, business: null }
  const jwt = (await import('jsonwebtoken')).default
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401, business: null }
  }
  const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404, business: null }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403, business: null }
  return { error: null, status: 200, business }
}

export async function POST(request, { params }) {
  try {
    const { businessId } = params
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : ''
    if (!placeId) {
      return NextResponse.json({ ok: false, error: 'placeId required' }, { status: 400 })
    }

    const database = await connect()

    if (authorizedByInternalSecret(request)) {
      const biz = await database.collection(COLLECTION_NAME).findOne({ businessId })
      if (!biz) {
        return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
      }
    } else {
      const auth = await verifyOwner(request, database, businessId)
      if (auth.error) {
        return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
      }
    }

    if (!corePlacesConfigured()) {
      return NextResponse.json({ ok: false, error: 'Places service not configured' }, { status: 503 })
    }

    const base = corePlacesBaseUrl()
    const headersJson = corePlacesInternalHeaders(true)

    /** @type {ReturnType<typeof sanitizeGooglePlacesForPublic> | null} */
    let googlePlaces = null

    const syncUrl = `${base}/api/businesses/${encodeURIComponent(businessId)}/sync-google-places`
    try {
      const syncRes = await fetch(syncUrl, {
        method: 'POST',
        headers: headersJson,
        body: JSON.stringify({ placeId }),
        cache: 'no-store'
      })
      if (syncRes.ok) {
        const d = await syncRes.json().catch(() => ({}))
        if (d.googlePlaces && typeof d.googlePlaces === 'object') {
          googlePlaces = sanitizeGooglePlacesForPublic(d.googlePlaces)
          const sc = coverPhotoFromSyncPayload(
            /** @type {Record<string, unknown>} */ (d.googlePlaces).coverPhoto
          )
          if (googlePlaces && sc) {
            googlePlaces = { ...googlePlaces, coverPhoto: sc }
          }
        }
      }
    } catch {
      /* try details */
    }

    if (!googlePlaces) {
      try {
        const detUrl = new URL(`${base}/api/places/details`)
        detUrl.searchParams.set('placeId', placeId)
        const detRes = await fetch(detUrl.toString(), {
          headers: corePlacesInternalHeaders(false),
          cache: 'no-store'
        })
        if (detRes.ok) {
          const raw = await detRes.json().catch(() => null)
          googlePlaces = placeDetailsToStoredGooglePlaces(raw)
        }
      } catch {
        /* ignore */
      }
    }

    if (!googlePlaces) {
      googlePlaces = sanitizeGooglePlacesForPublic({ placeId })
    }

    if (!googlePlaces) {
      return NextResponse.json({ ok: false, error: 'Could not load Google Places data' }, { status: 502 })
    }

    if (!googlePlaces.placeId) {
      googlePlaces = { ...googlePlaces, placeId }
    }

    googlePlaces = await ensureCoverPhotoCached(googlePlaces, businessId)

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      {
        $set: { googlePlaceId: placeId, googlePlaces, updatedAt: new Date() },
        $unset: { googleReviewsCache: '' }
      }
    )

    const googlePlacesResponse = sanitizeGooglePlacesForPublic(googlePlaces) || googlePlaces
    return NextResponse.json({ ok: true, googlePlaces: googlePlacesResponse })
  } catch (e) {
    console.error('[google-places POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { businessId } = params
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      {
        $unset: { googlePlaces: '', googlePlaceId: '' },
        $set: { updatedAt: new Date() }
      }
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[google-places DELETE]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
