/**
 * POST / DELETE /api/business/[businessId]/logo
 * Owner-only proxy to core-api multipart logo upload / delete.
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

async function syncCoreApiProfile(businessId, profile) {
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  if (!baseUrl || !apiKey) return
  try {
    const res = await fetch(`${baseUrl}/api/business/${encodeURIComponent(businessId)}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-api-key': apiKey,
        ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
      },
      body: JSON.stringify({ businessProfile: profile }),
      cache: 'no-store'
    })
    if (!res.ok) {
      console.warn('[business/logo] core-api profile sync non-OK:', res.status)
    }
  } catch (e) {
    console.warn('[business/logo] core-api profile sync failed:', e?.message || e)
  }
}

function logoFromCoreResponse(data) {
  if (!data || typeof data !== 'object') return null
  const nested = data.logo
  if (nested && typeof nested === 'object' && typeof nested.url === 'string') {
    return normalizeBusinessLogo(nested)
  }
  if (typeof data.url === 'string') {
    return normalizeBusinessLogo({ url: data.url })
  }
  return null
}

/** POST — multipart field `file` (or `logo`) forwarded to core-api */
export async function POST(request, { params }) {
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

    let incoming
    try {
      incoming = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
    }

    const file = incoming.get('file') || incoming.get('logo')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })
    }

    const outgoing = new FormData()
    outgoing.append('file', file)

    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
    const coreRes = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/logo`,
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

    const logo = logoFromCoreResponse(data)
    if (!logo?.url) {
      return NextResponse.json(
        { ok: false, error: 'Could not save your logo. Please try again.' },
        { status: 502 }
      )
    }

    const prev = auth.business.businessProfile && typeof auth.business.businessProfile === 'object'
      ? auth.business.businessProfile
      : {}
    const nextProfile = { ...prev, logo }

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { businessProfile: nextProfile, updatedAt: new Date() } }
    )

    void syncCoreApiProfile(businessId, nextProfile)

    return NextResponse.json({ ok: true, logo, url: logo.url })
  } catch (e) {
    console.error('[business/logo POST]', e)
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

    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
    const coreRes = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/logo`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...coreHeaders()
      },
      cache: 'no-store'
    })

    if (!coreRes.ok && coreRes.status !== 404) {
      const errBody = await coreRes.json().catch(() => ({}))
      return NextResponse.json(
        { ok: false, error: errBody.error || errBody.message || `Delete failed (${coreRes.status})` },
        { status: coreRes.status >= 400 && coreRes.status < 600 ? coreRes.status : 502 }
      )
    }

    const prev =
      auth.business.businessProfile && typeof auth.business.businessProfile === 'object'
        ? { ...auth.business.businessProfile }
        : {}
    delete prev.logo
    const nextProfile = prev

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { businessProfile: nextProfile, updatedAt: new Date() } }
    )

    void syncCoreApiProfile(businessId, nextProfile)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[business/logo DELETE]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
