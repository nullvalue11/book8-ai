/**
 * Proxy to core-api schedule API.
 * BOO-49: Retries on 404/503 (core tenant lag after n8n) + Mongo fallback so onboarding can save hours.
 * GET/PUT /api/business/[businessId]/schedule
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

function getCoreApiBaseUrl() {
  return (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
}

function getCoreProxyHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Core may return 404 until tenant provisioning finishes (n8n / async). */
const RETRIABLE_STATUS = new Set([404, 408, 502, 503, 504])
const MAX_CORE_ATTEMPTS = 10
const INITIAL_BACKOFF_MS = 400

async function getScheduleFromCoreWithRetry(baseUrl, businessId, headers) {
  let lastRes = null
  let lastData = null
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/schedule`
  for (let attempt = 0; attempt < MAX_CORE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 5000)
      await sleep(delay)
    }
    lastRes = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store'
    })
    lastData = await lastRes.json().catch(() => ({}))
    if (lastRes.ok) return { ok: true, res: lastRes, data: lastData }
    if (!RETRIABLE_STATUS.has(lastRes.status)) break
  }
  return { ok: false, res: lastRes, data: lastData }
}

async function putScheduleToCoreWithRetry(baseUrl, businessId, headers, body) {
  let lastRes = null
  let lastData = null
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/schedule`
  for (let attempt = 0; attempt < MAX_CORE_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 5000)
      await sleep(delay)
    }
    lastRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    })
    lastData = await lastRes.json().catch(() => ({}))
    if (lastRes.ok) return { ok: true, res: lastRes, data: lastData }
    if (!RETRIABLE_STATUS.has(lastRes.status)) break
  }
  return { ok: false, res: lastRes, data: lastData }
}

function normalizeScheduleBody(body) {
  const timezone = body?.timezone != null ? String(body.timezone) : 'UTC'
  const weeklyHours = body?.weeklyHours && typeof body.weeklyHours === 'object' ? body.weeklyHours : {}
  return { timezone, weeklyHours }
}

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const baseUrl = getCoreApiBaseUrl()
    const headers = getCoreProxyHeaders()
    const coreResult = await getScheduleFromCoreWithRetry(baseUrl, businessId, headers)

    if (coreResult.ok) {
      return NextResponse.json(coreResult.data)
    }

    const doc = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
    const local = doc?.localSchedule
    if (local?.weeklyHours && typeof local.weeklyHours === 'object') {
      return NextResponse.json({
        ok: true,
        schedule: {
          timezone: local.timezone || 'UTC',
          weeklyHours: local.weeklyHours
        },
        source: 'local_pending_sync'
      })
    }

    return NextResponse.json(
      coreResult.data && typeof coreResult.data === 'object'
        ? { ...coreResult.data, ok: false }
        : { ok: false, error: 'Core API error' },
      { status: coreResult.res?.status || 502 }
    )
  } catch (e) {
    console.error('[business/schedule] GET error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const rawBody = await request.json().catch(() => ({}))
    const { timezone, weeklyHours } = normalizeScheduleBody(rawBody)
    const baseUrl = getCoreApiBaseUrl()
    const headers = getCoreProxyHeaders()
    const payload = { timezone, weeklyHours }

    const coreResult = await putScheduleToCoreWithRetry(baseUrl, businessId, headers, payload)

    if (coreResult.ok) {
      await database.collection(BUSINESS_COLLECTION).updateOne(
        { businessId },
        {
          $set: { updatedAt: new Date() },
          $unset: { pendingCoreScheduleSync: '', localSchedule: '' }
        }
      )
      return NextResponse.json(coreResult.data)
    }

    console.warn('[business/schedule] Core PUT failed after retries; persisting hours on business doc', {
      businessId,
      status: coreResult.res?.status
    })

    await database.collection(BUSINESS_COLLECTION).updateOne(
      { businessId },
      {
        $set: {
          localSchedule: {
            timezone,
            weeklyHours,
            updatedAt: new Date()
          },
          pendingCoreScheduleSync: true,
          updatedAt: new Date()
        }
      }
    )

    return NextResponse.json({
      ok: true,
      schedule: { timezone, weeklyHours },
      syncedToCore: false,
      message:
        'Hours saved. They will apply to your booking line once the account finishes syncing (usually within a minute).'
    })
  } catch (e) {
    console.error('[business/schedule] PUT error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
