/**
 * POST /api/bookings/create
 * Proxies to core-api internal execute-tool (booking.create) so bookings
 * go to core-api (source of truth), not local MongoDB.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function requireAuthAndBusiness(request, database, businessId) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401 }
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

export async function POST(request) {
  try {
    const database = await connect()
    const body = await request.json().catch(() => ({}))
    const {
      businessId,
      serviceId,
      slot,
      customerName,
      customerPhone,
      customerEmail,
      startTime,
      endTime,
      title,
      notes
    } = body

    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }

    const authResult = await requireAuthAndBusiness(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json(
        { ok: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Build slot: prefer explicit slot, else startTime/endTime from form
    let slotStart = slot?.start ?? startTime
    let slotEnd = slot?.end ?? endTime
    if (slotStart && typeof slotStart === 'string' && !slotStart.endsWith('Z') && slotStart.indexOf('T') !== -1) {
      slotStart = new Date(slotStart).toISOString()
    }
    if (slotEnd && typeof slotEnd === 'string' && !slotEnd.endsWith('Z') && slotEnd.indexOf('T') !== -1) {
      slotEnd = new Date(slotEnd).toISOString()
    }
    if (!slotStart || !slotEnd) {
      return NextResponse.json(
        { ok: false, error: 'startTime and endTime (or slot.start/slot.end) are required' },
        { status: 400 }
      )
    }

    const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
    const secret = env.CORE_API_INTERNAL_SECRET || ''
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: 'Core API internal secret not configured' },
        { status: 500 }
      )
    }

    const toolPayload = {
      tool: 'booking.create',
      input: {
        businessId,
        serviceId: serviceId || 'manual-booking',
        slot: { start: slotStart, end: slotEnd },
        customerName: customerName || 'Walk-in',
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        notes: notes || undefined,
        title: title || undefined
      }
    }

    const res = await fetch(`${baseUrl}/internal/execute-tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret
      },
      body: JSON.stringify(toolPayload),
      cache: 'no-store'
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error('[bookings/create] core-api error:', res.status, data)
      return NextResponse.json(
        { ok: false, error: data?.error || data?.message || 'Failed to create booking' },
        { status: res.status >= 400 ? res.status : 502 }
      )
    }

    return NextResponse.json(data?.result ?? data ?? { ok: true })
  } catch (err) {
    console.error('[bookings/create] Error:', err)
    return NextResponse.json(
      { ok: false, error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
