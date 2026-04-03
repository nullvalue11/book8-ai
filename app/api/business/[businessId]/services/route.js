/**
 * Proxy to core-api services API.
 * GET/POST /api/business/[businessId]/services
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { getUiPlanLimits } from '@/lib/plan-features'
import { resolveBusinessPlanKey } from '@/lib/subscription'

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

/** Next.js 15+ may pass `params` as a Promise */
async function resolveBusinessId(rawParams) {
  const p = rawParams instanceof Promise ? await rawParams : rawParams
  const id = p?.businessId
  if (id == null || typeof id !== 'string' || !String(id).trim()) return null
  try {
    return decodeURIComponent(String(id).trim())
  } catch {
    return String(id).trim()
  }
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

function getCoreApiBaseUrl() {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  return baseUrl.replace(/\/$/, '')
}

/** Same headers as BOO-42 bookings proxy: API key + internal secret when set. */
function getCoreApiProxyHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const businessId = await resolveBusinessId(params)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const baseUrl = getCoreApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/businesses/${businessId}/services`, {
      method: 'GET',
      headers: getCoreApiProxyHeaders(),
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data || { ok: false, error: 'Core API error' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[business/services] GET error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const database = await connect()
    const businessId = await resolveBusinessId(params)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const baseUrl = getCoreApiBaseUrl()
    const business = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
    const planKey = resolveBusinessPlanKey(business)
    const maxServices = getUiPlanLimits(planKey).maxServices
    if (maxServices !== -1) {
      const listRes = await fetch(`${baseUrl}/api/businesses/${businessId}/services`, {
        method: 'GET',
        headers: getCoreApiProxyHeaders(),
        cache: 'no-store'
      })
      const listData = await listRes.json().catch(() => ({}))
      const list = Array.isArray(listData?.services)
        ? listData.services
        : Array.isArray(listData)
          ? listData
          : []
      const count = list.length
      if (count >= maxServices) {
        return NextResponse.json(
          {
            ok: false,
            error: `Your plan allows up to ${maxServices} service${maxServices === 1 ? '' : 's'}. Upgrade to add more.`
          },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const res = await fetch(`${baseUrl}/api/businesses/${businessId}/services`, {
      method: 'POST',
      headers: getCoreApiProxyHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data || { ok: false, error: 'Core API error' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[business/services] POST error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
