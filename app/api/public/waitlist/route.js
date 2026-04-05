/**
 * POST /api/public/waitlist
 * Join waitlist (no auth). Persists locally; best-effort core-api proxy.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'
import { WAITLIST_COLLECTION, newWaitlistEntry, WAITLIST_TIME_RANGES } from '@/lib/waitlist'

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
    db.collection(WAITLIST_COLLECTION).createIndex({ businessId: 1, createdAt: -1 }).catch(() => {})
  }
  return db
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

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim())
}

async function tryCoreWaitlist(businessId, payload) {
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  if (!baseUrl) return
  try {
    const res = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/waitlist`,
      {
        method: 'POST',
        headers: coreHeaders(),
        body: JSON.stringify(payload),
        cache: 'no-store'
      }
    )
    if (!res.ok && res.status !== 404) {
      console.warn('[public/waitlist] core non-OK:', res.status)
    }
  } catch (e) {
    console.warn('[public/waitlist] core failed:', e?.message || e)
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
    const handle = typeof body.handle === 'string' ? body.handle.trim() : ''
    if (!handle) {
      return NextResponse.json({ ok: false, error: 'handle required' }, { status: 400 })
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, error: 'Name required' }, { status: 400 })
    }
    if (!isEmail(email)) {
      return NextResponse.json({ ok: false, error: 'Valid email required' }, { status: 400 })
    }

    const preferredDates = Array.isArray(body.preferredDates)
      ? body.preferredDates.slice(0, 8).map((d) => String(d).trim()).filter(Boolean)
      : []
    if (preferredDates.length === 0) {
      return NextResponse.json({ ok: false, error: 'At least one preferred date required' }, { status: 400 })
    }

    const preferredTimeRange = WAITLIST_TIME_RANGES.includes(body.preferredTimeRange)
      ? body.preferredTimeRange
      : 'any'

    const database = await connect()
    const business = await findBusinessByPublicHandle(
      database.collection(COLLECTION_NAME),
      handle
    )
    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    if (business.waitlistEnabled === false) {
      return NextResponse.json({ ok: false, error: 'Waitlist is not available' }, { status: 403 })
    }

    const bid = business.businessId
    const serviceId = body.serviceId != null ? String(body.serviceId) : ''
    const serviceName = typeof body.serviceName === 'string' ? body.serviceName : ''

    const doc = newWaitlistEntry({
      businessId: bid,
      handle,
      serviceId,
      serviceName,
      preferredDates,
      preferredTimeRange,
      name,
      email,
      phone: body.phone
    })

    void tryCoreWaitlist(bid, {
      name,
      email,
      phone: doc.phone,
      preferredDates,
      preferredTimeRange,
      serviceId,
      serviceName
    })

    await database.collection(WAITLIST_COLLECTION).insertOne(doc)

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (e) {
    console.error('[public/waitlist POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
