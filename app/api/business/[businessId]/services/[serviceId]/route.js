/**
 * DELETE /api/business/[businessId]/services/[serviceId]
 * PATCH — update service (name, duration, price, active, …)
 * Proxies to core-api.
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

/** Next.js 15+ may pass `params` as a Promise */
async function resolveIds(rawParams) {
  const p = rawParams instanceof Promise ? await rawParams : rawParams
  let businessId = p?.businessId
  let serviceId = p?.serviceId
  if (businessId != null && typeof businessId === 'string' && String(businessId).trim()) {
    try {
      businessId = decodeURIComponent(String(businessId).trim())
    } catch {
      businessId = String(businessId).trim()
    }
  } else {
    businessId = null
  }
  if (serviceId != null && typeof serviceId === 'string' && String(serviceId).trim()) {
    try {
      serviceId = decodeURIComponent(String(serviceId).trim())
    } catch {
      serviceId = String(serviceId).trim()
    }
  } else {
    serviceId = null
  }
  return { businessId, serviceId }
}

function businessIdQuery(businessId) {
  return { $or: [{ businessId }, { id: businessId }] }
}

function isOnboardingRequest(request) {
  try {
    return new URL(request.url).searchParams.get('onboarding') === 'true'
  } catch {
    return false
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
  const business = await database.collection(BUSINESS_COLLECTION).findOne(businessIdQuery(businessId))
  if (!business) return { error: 'Business not found', status: 404 }
  if (String(business.ownerUserId || '') !== String(payload.sub || '')) {
    return { error: 'Access denied', status: 403 }
  }
  return { payload }
}

function getCoreApiBaseUrl() {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  return baseUrl.replace(/\/$/, '')
}

/** Same pattern as BOO-42 bookings proxy: API key + internal secret when set. */
function getCoreApiAuthHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(secret && { 'x-book8-internal-secret': secret })
  }
}

export async function PATCH(request, { params }) {
  try {
    const database = await connect()
    const { businessId, serviceId } = await resolveIds(params)
    if (!businessId || !serviceId) {
      return NextResponse.json({ ok: false, error: 'businessId and serviceId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const decodedId = serviceId
    const body = await request.json().catch(() => ({}))
    const baseUrl = getCoreApiBaseUrl()
    const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(decodedId)}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: getCoreApiAuthHeaders(),
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        data && typeof data === 'object' ? { ...data, ok: false } : { ok: false, error: 'Booking service unavailable. Please try again.' },
        { status: res.status }
      )
    }
    return NextResponse.json(data?.ok === false ? data : { ok: true, ...data })
  } catch (e) {
    console.error('[business/services/serviceId] PATCH error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const database = await connect()
    const { businessId, serviceId } = await resolveIds(params)
    if (!businessId || !serviceId) {
      return NextResponse.json({ ok: false, error: 'businessId and serviceId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const decodedId = serviceId

    if (isOnboardingRequest(request)) {
      const col = database.collection(BUSINESS_COLLECTION)
      const q = businessIdQuery(businessId)
      await col.updateOne(q, {
        $pull: { localServices: { serviceId: decodedId } },
        $set: { updatedAt: new Date(), pendingCoreServicesSync: true }
      })
      const doc = await col.findOne(q)
      if (!Array.isArray(doc?.localServices) || doc.localServices.length === 0) {
        await col.updateOne(q, { $unset: { pendingCoreServicesSync: '' } })
      }
      return NextResponse.json({ ok: true, deleted: true, source: 'local' })
    }

    const baseUrl = getCoreApiBaseUrl()
    const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(decodedId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getCoreApiAuthHeaders()
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        data && typeof data === 'object' ? { ...data, ok: false } : { ok: false, error: 'Booking service unavailable. Please try again.' },
        { status: res.status }
      )
    }
    return NextResponse.json(data?.ok === false ? data : { ok: true, ...data })
  } catch (e) {
    console.error('[business/services/serviceId] DELETE error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
