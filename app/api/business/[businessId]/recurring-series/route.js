/**
 * BOO-60B: list / cancel recurring series (Mongo bookings).
 * GET ?seriesId=  — all occurrences for owner
 * POST { action: 'cancel_one' | 'cancel_future', bookingId }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

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

async function verifyAuthAndOwnership(request, database, businessId) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401 }
  const jwt = (await import('jsonwebtoken')).default
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
  const business = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404 }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403 }
  return { payload }
}

function mapRow(lb) {
  return {
    id: lb.id,
    bookingId: lb.id,
    slot: { start: lb.startTime, end: lb.endTime },
    startTime: lb.startTime,
    endTime: lb.endTime,
    customerName: lb.customerName,
    customer: {
      name: lb.customerName,
      email: lb.guestEmail,
      phone: lb.guestPhone
    },
    serviceId: lb.serviceId,
    serviceName: lb.serviceName,
    status: lb.status || 'confirmed',
    recurring: lb.recurring
  }
}

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const seriesId = new URL(request.url).searchParams.get('seriesId') || ''
    if (!seriesId.trim()) {
      return NextResponse.json({ ok: false, error: 'seriesId required' }, { status: 400 })
    }
    const rows = await database
      .collection('bookings')
      .find({
        businessId,
        'recurring.seriesId': seriesId.trim()
      })
      .sort({ 'recurring.occurrenceNumber': 1 })
      .limit(100)
      .toArray()
    return NextResponse.json({ ok: true, bookings: rows.map(mapRow) })
  } catch (e) {
    console.error('[recurring-series GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const action = typeof body.action === 'string' ? body.action : ''
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : ''
    if (!bookingId || !['cancel_one', 'cancel_future'].includes(action)) {
      return NextResponse.json({ ok: false, error: 'bookingId and valid action required' }, { status: 400 })
    }

    const col = database.collection('bookings')
    const booking = await col.findOne({ id: bookingId, businessId })
    if (!booking?.recurring?.seriesId) {
      return NextResponse.json({ ok: false, error: 'Booking not found or not recurring' }, { status: 404 })
    }
    const sid = booking.recurring.seriesId
    const occ = Number(booking.recurring.occurrenceNumber) || 1
    const nowIso = new Date().toISOString()

    if (action === 'cancel_one') {
      await col.updateOne(
        { id: bookingId, businessId },
        { $set: { status: 'canceled', updatedAt: nowIso } }
      )
    } else {
      await col.updateMany(
        {
          businessId,
          'recurring.seriesId': sid,
          'recurring.occurrenceNumber': { $gte: occ },
          status: { $nin: ['canceled', 'cancelled'] }
        },
        { $set: { status: 'canceled', updatedAt: nowIso } }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[recurring-series POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
