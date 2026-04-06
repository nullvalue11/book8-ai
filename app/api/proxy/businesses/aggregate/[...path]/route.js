/**
 * BOO-67B: Proxy aggregate multi-location endpoints to book8-core-api (BOO-67A).
 * BOO-77B: Forward core-api internal auth + owner email (aggregate routes do not accept user JWT).
 * GET /api/proxy/businesses/aggregate/stats | bookings | calls | analytics | ...
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { getCoreApiInternalHeadersJson, hasCoreApiInternalCredentials } from '@/lib/core-api-internal'

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

/**
 * Validate Book8 JWT, then resolve owner email for X-Book8-User-Email (core-api aggregate auth).
 */
async function requireUserEmail(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401 }

  const jwt = (await import('jsonwebtoken')).default
  /** @type {import('jsonwebtoken').JwtPayload | string} */
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
  if (typeof payload === 'string' || !payload) {
    return { error: 'Invalid token payload', status: 401 }
  }

  let email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const sub = payload.sub
  if (!email && sub) {
    const database = await connect()
    const user = await database.collection('users').findOne({ id: sub })
    email = typeof user?.email === 'string' ? user.email.trim() : ''
  }
  if (!email) {
    return { error: 'User email required for aggregate access', status: 401 }
  }

  return { email }
}

export async function GET(request, { params }) {
  const auth = await requireUserEmail(request)
  if ('error' in auth && auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { email: userEmail } = auth

  if (!hasCoreApiInternalCredentials()) {
    return NextResponse.json(
      { ok: false, error: 'Core API credentials not configured', code: 'CORE_API_UNAVAILABLE' },
      { status: 503 }
    )
  }

  const pathSegments = params?.path || []
  const subpath = pathSegments.join('/')
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: 'Core API not configured', code: 'CORE_API_UNAVAILABLE' },
      { status: 503 }
    )
  }

  const url = new URL(request.url)
  const qs = url.searchParams.toString()
  const target = `${baseUrl}/api/businesses/aggregate/${subpath}${qs ? `?${qs}` : ''}`

  const upstreamHeaders = {
    ...getCoreApiInternalHeadersJson(),
    'x-book8-user-email': userEmail
  }

  let res
  try {
    res = await fetch(target, {
      method: 'GET',
      headers: upstreamHeaders,
      cache: 'no-store'
    })
  } catch (err) {
    console.error('[proxy aggregate]', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Upstream request failed' },
      { status: 502 }
    )
  }

  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : { ok: res.ok }
  } catch {
    data = { ok: false, error: text?.slice(0, 200) || 'Invalid JSON from core-api' }
  }

  return NextResponse.json(data, { status: res.status })
}
