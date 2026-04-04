/**
 * POST /api/business/[businessId]/sync-to-core
 * BOO-56: Push localServices + localSchedule to core-api after onboarding (or from dashboard retry).
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

function businessIdQuery(businessId) {
  return { $or: [{ businessId }, { id: businessId }] }
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
  return { ok: true, business }
}

function getCoreApiBaseUrl() {
  return (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
}

function getCoreHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

const FETCH_MS = 25000

export async function POST(request, segmentCtx) {
  try {
    const businessId = await resolveBusinessId(segmentCtx.params)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const database = await connect()
    const auth = await verifyAuthAndOwnership(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const col = database.collection(BUSINESS_COLLECTION)
    const business = auth.business
    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const baseUrl = getCoreApiBaseUrl()
    const headers = getCoreHeaders()
    const signal = AbortSignal.timeout(FETCH_MS)

    const localServices = Array.isArray(business.localServices) ? business.localServices : []
    let servicesSynced = 0
    let servicesError = false

    for (const s of localServices) {
      const body = {
        serviceId: s.serviceId,
        name: s.name,
        durationMinutes: Number(s.durationMinutes) || 30,
        active: s.active !== false,
        price: s.price ?? null,
        currency: s.currency ?? null
      }
      try {
        const res = await fetch(
          `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            cache: 'no-store',
            signal
          }
        )
        if (res.ok) servicesSynced += 1
        else servicesError = true
      } catch {
        servicesError = true
      }
    }

    const hadServices = localServices.length > 0
    const allServicesSynced = hadServices && servicesSynced === localServices.length && !servicesError

    const ls = business.localSchedule
    let scheduleSynced = false
    if (ls?.weeklyHours && typeof ls.weeklyHours === 'object') {
      try {
        const res = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/schedule`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            timezone: ls.timezone || business.timezone || 'UTC',
            weeklyHours: ls.weeklyHours
          }),
          cache: 'no-store',
          signal
        })
        scheduleSynced = res.ok
      } catch {
        scheduleSynced = false
      }
    }

    const $unset = {}
    if (allServicesSynced) {
      $unset.localServices = ''
      $unset.pendingCoreServicesSync = ''
    }
    if (scheduleSynced) {
      $unset.localSchedule = ''
      $unset.pendingCoreScheduleSync = ''
    }

    const op = { $set: { updatedAt: new Date() } }
    if (Object.keys($unset).length > 0) {
      op.$unset = $unset
    }
    await col.updateOne(businessIdQuery(businessId), op)

    return NextResponse.json({
      ok: true,
      results: {
        services: allServicesSynced ? 'synced' : hadServices ? 'pending' : 'skipped',
        schedule: scheduleSynced ? 'synced' : ls?.weeklyHours ? 'pending' : 'skipped'
      }
    })
  } catch (e) {
    console.error('[business/sync-to-core]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
