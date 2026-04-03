/**
 * Proxy to core-api schedule API.
 * BOO-49: Retries + Mongo fallback when core tenant lags.
 * BOO-51: ?onboarding=true — 2 quick attempts (1s timeout), then immediate Mongo fallback (setup must not wait on core).
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

async function fetchCoreJson(url, init, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  } finally {
    clearTimeout(timer)
  }
}

const RETRIABLE_STATUS = new Set([404, 408, 502, 503, 504])

function isOnboardingFastPath(request) {
  try {
    return new URL(request.url).searchParams.get('onboarding') === 'true'
  } catch {
    return false
  }
}

/** Dashboard / default GET */
const GET_TIMEOUT_MS = 7000
const GET_MAX_ATTEMPTS = 2
const GET_BACKOFF_MS = 350

/** Dashboard PUT — full patience when business should exist in core */
const PUT_TIMEOUT_MS = 12000
const PUT_MAX_ATTEMPTS = 10
const PUT_INITIAL_BACKOFF_MS = 400

/** Setup wizard: fast fail then Mongo (BOO-51) */
const ONBOARDING_MAX_ATTEMPTS = 2
const ONBOARDING_TIMEOUT_MS = 1000
const ONBOARDING_BACKOFF_MS = 0

function scheduleGetProfile(onboarding) {
  if (onboarding) {
    return {
      maxAttempts: ONBOARDING_MAX_ATTEMPTS,
      timeoutMs: ONBOARDING_TIMEOUT_MS,
      backoffMs: ONBOARDING_BACKOFF_MS,
      exponentialBackoff: false
    }
  }
  return {
    maxAttempts: GET_MAX_ATTEMPTS,
    timeoutMs: GET_TIMEOUT_MS,
    backoffMs: GET_BACKOFF_MS,
    exponentialBackoff: false
  }
}

function schedulePutProfile(onboarding) {
  if (onboarding) {
    return {
      maxAttempts: ONBOARDING_MAX_ATTEMPTS,
      timeoutMs: ONBOARDING_TIMEOUT_MS,
      backoffMs: ONBOARDING_BACKOFF_MS,
      exponentialBackoff: false
    }
  }
  return {
    maxAttempts: PUT_MAX_ATTEMPTS,
    timeoutMs: PUT_TIMEOUT_MS,
    backoffMs: PUT_INITIAL_BACKOFF_MS,
    exponentialBackoff: true
  }
}

async function getScheduleFromCoreWithRetry(baseUrl, businessId, headers, profile) {
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/schedule`
  let lastRes = null
  let lastData = null
  const { maxAttempts, timeoutMs, backoffMs, exponentialBackoff } = profile
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = exponentialBackoff
        ? Math.min(PUT_INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 5000)
        : backoffMs
      await sleep(delay)
    }
    try {
      const { res, data } = await fetchCoreJson(url, { method: 'GET', headers }, timeoutMs)
      lastRes = res
      lastData = data
      if (res.ok) return { ok: true, res, data }
      if (!RETRIABLE_STATUS.has(res.status)) break
    } catch (e) {
      lastRes = { status: 503, ok: false }
      lastData = { error: e?.name === 'AbortError' ? 'Request timeout' : String(e?.message || e) }
      if (attempt + 1 >= maxAttempts) break
    }
  }
  return { ok: false, res: lastRes, data: lastData }
}

async function putScheduleToCoreWithRetry(baseUrl, businessId, headers, body, profile) {
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/schedule`
  let lastRes = null
  let lastData = null
  const { maxAttempts, timeoutMs, backoffMs, exponentialBackoff } = profile
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = exponentialBackoff
        ? Math.min(PUT_INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 5000)
        : backoffMs
      await sleep(delay)
    }
    try {
      const { res, data } = await fetchCoreJson(
        url,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        },
        timeoutMs
      )
      lastRes = res
      lastData = data
      if (res.ok) return { ok: true, res, data }
      if (!RETRIABLE_STATUS.has(res.status)) break
    } catch (e) {
      lastRes = { status: 503, ok: false }
      lastData = { error: e?.name === 'AbortError' ? 'Request timeout' : String(e?.message || e) }
      if (attempt + 1 >= maxAttempts) break
    }
  }
  return { ok: false, res: lastRes, data: lastData }
}

function normalizeScheduleBody(body) {
  const timezone = body?.timezone != null ? String(body.timezone) : 'UTC'
  const weeklyHours = body?.weeklyHours && typeof body.weeklyHours === 'object' ? body.weeklyHours : {}
  return { timezone, weeklyHours }
}

export async function GET(request, segmentCtx) {
  try {
    const businessId = await resolveBusinessId(segmentCtx.params)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const database = await connect()
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const baseUrl = getCoreApiBaseUrl()
    const headers = getCoreProxyHeaders()
    const onboarding = isOnboardingFastPath(request)
    const coreResult = await getScheduleFromCoreWithRetry(
      baseUrl,
      businessId,
      headers,
      scheduleGetProfile(onboarding)
    )

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
        : { ok: false, error: 'Booking service unavailable. Please try again.' },
      { status: coreResult.res?.status && coreResult.res.status >= 400 ? coreResult.res.status : 502 }
    )
  } catch (e) {
    console.error('[business/schedule] GET error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request, segmentCtx) {
  try {
    const businessId = await resolveBusinessId(segmentCtx.params)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const database = await connect()
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const rawBody = await request.json().catch(() => ({}))
    const { timezone, weeklyHours } = normalizeScheduleBody(rawBody)
    const baseUrl = getCoreApiBaseUrl()
    const headers = getCoreProxyHeaders()
    const payload = { timezone, weeklyHours }

    const onboarding = isOnboardingFastPath(request)
    const coreResult = await putScheduleToCoreWithRetry(
      baseUrl,
      businessId,
      headers,
      payload,
      schedulePutProfile(onboarding)
    )

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

    console.warn('[business/schedule] Booking service PUT failed after retries; persisting hours on business doc', {
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
