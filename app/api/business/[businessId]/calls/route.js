/**
 * Proxy to core-api for recent calls by business.
 * GET /api/business/[businessId]/calls
 * Uses internal auth (x-book8-internal-secret) — core-api has no public calls list endpoint.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
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

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
    const internalSecret = env.CORE_API_INTERNAL_SECRET || ''
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '20'

    const res = await fetch(
      `${baseUrl}/internal/calls/by-business/${businessId}?limit=${limit}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
        },
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ ok: true, calls: [] })
      }
      const errText = await res.text().catch(() => '')
      console.error('[business/calls] core-api error:', res.status, errText)
      return NextResponse.json({ ok: true, calls: [] })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data?.calls !== undefined ? data : { ok: true, calls: data || [] })
  } catch (err) {
    console.error('[business/calls] Error:', err)
    return NextResponse.json({ ok: true, calls: [] })
  }
}
