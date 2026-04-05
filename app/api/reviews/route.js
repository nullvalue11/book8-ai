/**
 * GET /api/reviews?token= — validate invite, return display context
 * POST /api/reviews — submit review (proxy core + persist Mongo)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { sanitizeBusinessProfileForPublic } from '@/lib/businessProfile'
import {
  REVIEWS_COLLECTION,
  decodeReviewInviteToken,
  newReviewDoc
} from '@/lib/reviews'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

let indexesEnsured = false

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  if (!indexesEnsured && db) {
    indexesEnsured = true
    db
      .collection(REVIEWS_COLLECTION)
      .createIndex({ businessId: 1, bookingId: 1 }, { unique: true })
      .catch(() => {})
  }
  return db
}

function businessIdQuery(businessId) {
  return { $or: [{ businessId }, { id: businessId }] }
}

function coreHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

async function tryCoreSubmitReview(token, rating, comment) {
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  if (!baseUrl) return
  try {
    const res = await fetch(`${baseUrl}/api/reviews`, {
      method: 'POST',
      headers: coreHeaders(),
      body: JSON.stringify({ token, rating, comment }),
      cache: 'no-store'
    })
    if (!res.ok && res.status !== 404) {
      console.warn('[reviews] core POST non-OK:', res.status)
    }
  } catch (e) {
    console.warn('[reviews] core POST failed:', e?.message || e)
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') || ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'token required' }, { status: 400 })
    }

    const decoded = decodeReviewInviteToken(token, env.JWT_SECRET)
    if (!decoded.ok) {
      return NextResponse.json({
        ok: true,
        state: decoded.reason === 'expired' ? 'expired' : 'invalid'
      })
    }

    const { data } = decoded
    const database = await connect()
    const existing = await database.collection(REVIEWS_COLLECTION).findOne({
      businessId: data.businessId,
      bookingId: data.bookingId
    })
    if (existing) {
      return NextResponse.json({
        ok: true,
        state: 'already_reviewed',
        lang: data.lang || 'en'
      })
    }

    const business = await database.collection(COLLECTION_NAME).findOne(businessIdQuery(data.businessId))
    if (!business) {
      return NextResponse.json({ ok: true, state: 'invalid' })
    }

    const profile = sanitizeBusinessProfileForPublic(business.businessProfile)
    const logoUrl = profile?.logo?.url || null
    let appointmentLabel = ''
    if (data.appointmentAt) {
      try {
        appointmentLabel = new Date(data.appointmentAt).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch {
        appointmentLabel = data.appointmentAt
      }
    }

    return NextResponse.json({
      ok: true,
      state: 'ready',
      lang: data.lang,
      businessName: business.name || 'Business',
      logoUrl,
      serviceName: data.serviceName || '',
      appointmentLabel,
      customerName: data.customerName || ''
    })
  } catch (e) {
    console.error('[reviews GET]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const token = typeof body.token === 'string' ? body.token : ''
    const rating = Number(body.rating)
    const comment = typeof body.comment === 'string' ? body.comment : ''
    if (!token) {
      return NextResponse.json({ ok: false, error: 'token required' }, { status: 400 })
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: 'rating must be 1–5' }, { status: 400 })
    }

    const decoded = decodeReviewInviteToken(token, env.JWT_SECRET)
    if (!decoded.ok) {
      const msg =
        decoded.reason === 'expired' ? 'This review link has expired.' : 'Invalid review link.'
      return NextResponse.json(
        { ok: false, error: msg, code: decoded.reason },
        { status: decoded.reason === 'expired' ? 410 : 400 }
      )
    }

    const { data } = decoded
    const database = await connect()
    const col = database.collection(REVIEWS_COLLECTION)

    const dup = await col.findOne({ businessId: data.businessId, bookingId: data.bookingId })
    if (dup) {
      return NextResponse.json(
        { ok: false, error: "You've already left a review for this appointment.", code: 'duplicate' },
        { status: 409 }
      )
    }

    void tryCoreSubmitReview(token, rating, comment)

    const doc = newReviewDoc({
      businessId: data.businessId,
      bookingId: data.bookingId,
      rating,
      comment,
      customerName: data.customerName,
      serviceName: data.serviceName,
      appointmentAt: data.appointmentAt || null,
      lang: data.lang
    })

    try {
      await col.insertOne(doc)
    } catch (e) {
      if (e?.code === 11000) {
        return NextResponse.json(
          { ok: false, error: "You've already left a review for this appointment.", code: 'duplicate' },
          { status: 409 }
        )
      }
      throw e
    }

    const business = await database.collection(COLLECTION_NAME).findOne(businessIdQuery(data.businessId))
    const businessName = business?.name || 'Business'

    return NextResponse.json({ ok: true, businessName })
  } catch (e) {
    console.error('[reviews POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
