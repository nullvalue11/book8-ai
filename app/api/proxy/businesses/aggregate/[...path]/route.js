/**
 * BOO-67B: Proxy aggregate multi-location endpoints to book8-core-api (BOO-67A).
 * GET /api/proxy/businesses/aggregate/stats | bookings | calls | analytics | ...
 */

import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function verifyJwt(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401 }
  const jwt = (await import('jsonwebtoken')).default
  try {
    jwt.verify(token, env.JWT_SECRET)
    return { token }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function GET(request, { params }) {
  const v = await verifyJwt(request)
  if (v.error) {
    return NextResponse.json({ ok: false, error: v.error }, { status: v.status })
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

  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

  let res
  try {
    res = await fetch(target, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${v.token}`,
        ...(internalSecret ? { 'x-book8-internal-secret': internalSecret } : {})
      },
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
