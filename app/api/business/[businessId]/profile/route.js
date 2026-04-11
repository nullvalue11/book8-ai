/**
 * GET/PATCH /api/business/[businessId]/profile
 * Owner-only business public profile for booking page + best-effort core-api sync.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import {
  parseBusinessProfileBody,
  normalizeBusinessLogo,
  mergeCoreProfileAddressIntoLocal
} from '@/lib/businessProfile'
import { sanitizeGooglePlacesForPublic } from '@/lib/googlePlaces'
import { getCoreBusinessRecord, patchCoreBusinessProfile } from '@/lib/coreApiBusinessProfile'

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
  if (!token) return { error: 'Authentication required', status: 401, userId: null, user: null }
  const jwt = (await import('jsonwebtoken')).default
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401, userId: null, user: null }
  }
  const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404, userId: null, user: null }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403, userId: null, user: null }
  const user = await database.collection('users').findOne({ id: payload.sub })
  if (!user) return { error: 'User not found', status: 404, userId: null, user: null }
  return { business, userId: payload.sub, user }
}

export async function GET(request, { params }) {
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
    return NextResponse.json({
      ok: true,
      businessProfile: auth.business.businessProfile || null,
      handle: auth.business.handle || null,
      timezone: auth.business.timezone || null,
      googlePlaces: sanitizeGooglePlacesForPublic(auth.business.googlePlaces) || null,
      googlePlaceId: typeof auth.business.googlePlaceId === 'string' ? auth.business.googlePlaceId : null
    })
  } catch (e) {
    console.error('[business/profile GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const raw = body.businessProfile != null ? body.businessProfile : body
    const parsed = parseBusinessProfileBody(raw)
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 })
    }

    const existingProfile =
      auth.business.businessProfile && typeof auth.business.businessProfile === 'object'
        ? auth.business.businessProfile
        : {}
    const mergedProfile = { ...parsed.profile }
    const preservedLogo = normalizeBusinessLogo(existingProfile.logo)
    if (preservedLogo) mergedProfile.logo = preservedLogo

    const apiKey = env.BOOK8_CORE_API_KEY || ''
    if (apiKey) {
      const coreResult = await patchCoreBusinessProfile(businessId, auth.user?.email, mergedProfile)
      if (!coreResult.ok) {
        const status = coreResult.status
        let message = coreResult.error
        if (status === 402) {
          message =
            message ||
            'Your plan or trial does not allow this update. Upgrade or fix billing to continue.'
        }
        if (status === 403) {
          message = message || 'You do not have permission to update this business profile.'
        }
        if (status === 401) {
          message =
            message ||
            'Could not verify your account with the booking service. Sign in again, or use the same email as on file for this business.'
        }
        return NextResponse.json(
          { ok: false, error: message, code: coreResult.code },
          { status: status >= 400 && status < 600 ? status : 502 }
        )
      }
    } else {
      console.warn('[business/profile PATCH] BOOK8_CORE_API_KEY not set; saving to Mongo only')
    }

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { businessProfile: mergedProfile, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, businessProfile: mergedProfile })
  } catch (e) {
    console.error('[business/profile PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
