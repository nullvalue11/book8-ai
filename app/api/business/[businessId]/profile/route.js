/**
 * GET/PATCH /api/business/[businessId]/profile
 * Owner-only business public profile for booking page + best-effort core-api sync.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { parseBusinessProfileBody } from '@/lib/businessProfile'

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
  if (!token) return { error: 'Authentication required', status: 401, userId: null }
  const jwt = (await import('jsonwebtoken')).default
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401, userId: null }
  }
  const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404, userId: null }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403, userId: null }
  return { business, userId: payload.sub }
}

async function syncCoreApiProfile(businessId, profile) {
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  if (!baseUrl || !apiKey) return
  try {
    const res = await fetch(`${baseUrl}/api/business/${encodeURIComponent(businessId)}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-api-key': apiKey
      },
      body: JSON.stringify({ businessProfile: profile }),
      cache: 'no-store'
    })
    if (!res.ok) {
      console.warn('[business/profile] core-api PATCH non-OK:', res.status)
    }
  } catch (e) {
    console.warn('[business/profile] core-api sync failed:', e?.message || e)
  }
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
      timezone: auth.business.timezone || null
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

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { businessProfile: parsed.profile, updatedAt: new Date() } }
    )

    void syncCoreApiProfile(businessId, parsed.profile)

    return NextResponse.json({ ok: true, businessProfile: parsed.profile })
  } catch (e) {
    console.error('[business/profile PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
