/**
 * POST /api/business/[businessId]/providers/[providerId]/avatar
 * Multipart proxy → core-api; updates provider.avatar in Mongo.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { normalizeBusinessLogo } from '@/lib/businessProfile'

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
  if (!token) return { error: 'Authentication required', status: 401 }
  const jwt = (await import('jsonwebtoken')).default
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
  const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404 }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403 }
  return { business }
}

function coreHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

function avatarFromResponse(data) {
  if (!data || typeof data !== 'object') return null
  const a = data.avatar || data.logo
  if (a && typeof a === 'object' && typeof a.url === 'string') return normalizeBusinessLogo(a)
  if (typeof data.url === 'string') return normalizeBusinessLogo({ url: data.url })
  return null
}

export async function POST(request, { params }) {
  try {
    const { businessId, providerId } = params
    if (!businessId || !providerId) {
      return NextResponse.json({ ok: false, error: 'businessId and providerId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    let incoming
    try {
      incoming = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
    }

    const file = incoming.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })
    }

    const outgoing = new FormData()
    outgoing.append('file', file)

    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
    const coreRes = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/providers/${encodeURIComponent(providerId)}/avatar`,
      {
        method: 'POST',
        headers: coreHeaders(),
        body: outgoing,
        cache: 'no-store'
      }
    )

    const data = await coreRes.json().catch(() => ({}))
    if (!coreRes.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || data.message || `Upload failed (${coreRes.status})` },
        { status: coreRes.status >= 400 && coreRes.status < 600 ? coreRes.status : 502 }
      )
    }

    const avatar = avatarFromResponse(data)
    if (!avatar?.url) {
      return NextResponse.json(
        { ok: false, error: 'Could not save your photo. Please try again.' },
        { status: 502 }
      )
    }

    const list = Array.isArray(auth.business.providers) ? [...auth.business.providers] : []
    const idx = list.findIndex((p) => p && String(p.id) === String(providerId))
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 })
    }

    list[idx] = { ...list[idx], avatar }
    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { providers: list, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, avatar, url: avatar.url })
  } catch (e) {
    console.error('[provider/avatar POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
