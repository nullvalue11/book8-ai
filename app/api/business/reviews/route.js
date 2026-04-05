/**
 * GET /api/business/reviews — all reviews for businesses owned by JWT user
 * PATCH /api/business/reviews — { reviewId, status: 'published' | 'hidden' }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { REVIEWS_COLLECTION } from '@/lib/reviews'

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

async function authUserId(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401, userId: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return { userId: String(payload.sub || '') }
  } catch {
    return { error: 'Invalid or expired token', status: 401, userId: null }
  }
}

export async function GET(request) {
  try {
    const auth = await authUserId(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const database = await connect()
    const businesses = await database
      .collection(COLLECTION_NAME)
      .find({ ownerUserId: auth.userId })
      .project({ businessId: 1, name: 1 })
      .toArray()
    const ids = businesses.map((b) => b.businessId).filter(Boolean)
    const nameById = Object.fromEntries(
      businesses.map((b) => [b.businessId, b.name || b.businessId])
    )
    if (!ids.length) {
      return NextResponse.json({ ok: true, reviews: [] })
    }
    const rows = await database
      .collection(REVIEWS_COLLECTION)
      .find({ businessId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray()
    const reviews = rows.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      businessName: nameById[r.businessId] || r.businessId,
      bookingId: r.bookingId,
      rating: r.rating,
      comment: r.comment || '',
      customerName: r.customerName || '',
      serviceName: r.serviceName || '',
      status: r.status === 'hidden' ? 'hidden' : 'published',
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      appointmentAt:
        r.appointmentAt instanceof Date ? r.appointmentAt.toISOString() : r.appointmentAt || null,
      lang: r.lang || 'en'
    }))
    return NextResponse.json({ ok: true, reviews })
  } catch (e) {
    console.error('[business/reviews GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const auth = await authUserId(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const reviewId = typeof body.reviewId === 'string' ? body.reviewId : ''
    const status = body.status === 'hidden' ? 'hidden' : body.status === 'published' ? 'published' : null
    if (!reviewId || !status) {
      return NextResponse.json({ ok: false, error: 'reviewId and status required' }, { status: 400 })
    }

    const database = await connect()
    const col = database.collection(REVIEWS_COLLECTION)
    const review = await col.findOne({ id: reviewId })
    if (!review) {
      return NextResponse.json({ ok: false, error: 'Review not found' }, { status: 404 })
    }
    const owned = await database.collection(COLLECTION_NAME).findOne({
      businessId: review.businessId,
      ownerUserId: auth.userId
    })
    if (!owned) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 })
    }
    await col.updateOne(
      { id: reviewId },
      { $set: { status, updatedAt: new Date() } }
    )
    return NextResponse.json({ ok: true, status })
  } catch (e) {
    console.error('[business/reviews PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
