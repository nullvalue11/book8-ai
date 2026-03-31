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

function getCoreApiConfig() {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export async function PATCH(request, { params }) {
  try {
    const database = await connect()
    const { businessId, serviceId } = params
    if (!businessId || !serviceId) {
      return NextResponse.json({ ok: false, error: 'businessId and serviceId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const decodedId = decodeURIComponent(serviceId)
    const body = await request.json().catch(() => ({}))
    const { baseUrl, apiKey } = getCoreApiConfig()
    const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(decodedId)}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-book8-api-key': apiKey })
      },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        data && typeof data === 'object' ? { ...data, ok: false } : { ok: false, error: 'Core API error' },
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
    const { businessId, serviceId } = params
    if (!businessId || !serviceId) {
      return NextResponse.json({ ok: false, error: 'businessId and serviceId required' }, { status: 400 })
    }
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }
    const decodedId = decodeURIComponent(serviceId)
    const { baseUrl, apiKey } = getCoreApiConfig()
    const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services/${encodeURIComponent(decodedId)}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-book8-api-key': apiKey })
      }
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        data && typeof data === 'object' ? { ...data, ok: false } : { ok: false, error: 'Core API error' },
        { status: res.status }
      )
    }
    return NextResponse.json(data?.ok === false ? data : { ok: true, ...data })
  } catch (e) {
    console.error('[business/services/serviceId] DELETE error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
