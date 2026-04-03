/**
 * Proxy to core-api services API.
 * BOO-50: Retries + Mongo fallback when core tenant lags (n8n provisioning delay).
 * Mirrors app/api/business/[businessId]/schedule/route.js.
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

function businessIdQuery(businessId) {
  return { $or: [{ businessId }, { id: businessId }] }
}

/** Prefer flexible key matching — some docs / URLs use `id` only; compare owners as strings. */
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

const GET_TIMEOUT_MS = 7000
const GET_MAX_ATTEMPTS = 2
const GET_BACKOFF_MS = 350

/** Writes: wait for tenant rollout (BOO-50 — up to 10 attempts on 404/502/503/504) */
const POST_TIMEOUT_MS = 12000
const POST_MAX_ATTEMPTS = 10
const POST_INITIAL_BACKOFF_MS = 400

function getCoreApiBaseUrl() {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  return baseUrl.replace(/\/$/, '')
}

function getCoreApiProxyHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    'Content-Type': 'application/json',
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

async function getServicesFromCoreWithRetry(baseUrl, businessId, headers) {
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services`
  let lastRes = null
  let lastData = null
  for (let attempt = 0; attempt < GET_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(GET_BACKOFF_MS)
    }
    try {
      const { res, data } = await fetchCoreJson(url, { method: 'GET', headers }, GET_TIMEOUT_MS)
      lastRes = res
      lastData = data
      if (res.ok) return { ok: true, res, data }
      if (!RETRIABLE_STATUS.has(res.status)) break
    } catch (e) {
      lastRes = { status: 503, ok: false }
      lastData = { error: e?.name === 'AbortError' ? 'Request timeout' : String(e?.message || e) }
      if (attempt + 1 >= GET_MAX_ATTEMPTS) break
    }
  }
  return { ok: false, res: lastRes, data: lastData }
}

async function postServiceToCoreWithRetry(baseUrl, businessId, headers, body) {
  const url = `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services`
  let lastRes = null
  let lastData = null
  for (let attempt = 0; attempt < POST_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(POST_INITIAL_BACKOFF_MS * 2 ** (attempt - 1), 5000)
      await sleep(delay)
    }
    try {
      const { res, data } = await fetchCoreJson(
        url,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        },
        POST_TIMEOUT_MS
      )
      lastRes = res
      lastData = data
      if (res.ok) return { ok: true, res, data }
      if (!RETRIABLE_STATUS.has(res.status)) break
    } catch (e) {
      lastRes = { status: 503, ok: false }
      lastData = { error: e?.name === 'AbortError' ? 'Request timeout' : String(e?.message || e) }
      if (attempt + 1 >= POST_MAX_ATTEMPTS) break
    }
  }
  return { ok: false, res: lastRes, data: lastData }
}

function normalizeServicesList(raw) {
  if (Array.isArray(raw?.services)) return raw.services
  if (Array.isArray(raw)) return raw
  return []
}

function mapLocalServicesForResponse(local) {
  if (!Array.isArray(local) || local.length === 0) return []
  return local.map((s) => ({
    serviceId: s.serviceId,
    id: s.serviceId,
    name: s.name,
    durationMinutes: Number(s.durationMinutes) || 30,
    price: s.price ?? null,
    active: s.active !== false,
    currency: s.currency || null
  }))
}

function normalizeLocalServiceRow(body) {
  const serviceId = body?.serviceId != null ? String(body.serviceId) : null
  if (!serviceId) return null
  return {
    serviceId,
    name: body?.name != null ? String(body.name) : '',
    durationMinutes: Number(body?.durationMinutes) || 30,
    price: body?.price ?? null,
    currency: body?.currency != null ? String(body.currency) : null,
    active: body?.active !== false,
    updatedAt: new Date()
  }
}

async function upsertLocalServiceRow(database, businessId, row) {
  const col = database.collection(BUSINESS_COLLECTION)
  const q = businessIdQuery(businessId)
  const doc = await col.findOne(q)
  const prev = Array.isArray(doc?.localServices) ? doc.localServices : []
  const next = [...prev.filter((s) => String(s.serviceId) !== String(row.serviceId)), row]
  await col.updateOne(q, {
    $set: {
      localServices: next,
      pendingCoreServicesSync: true,
      updatedAt: new Date()
    }
  })
}

async function clearLocalServiceAfterCoreSync(database, businessId, serviceId) {
  if (serviceId == null) return
  const col = database.collection(BUSINESS_COLLECTION)
  const q = businessIdQuery(businessId)
  const sid = String(serviceId)
  await col.updateOne(q, {
    $pull: { localServices: { serviceId: sid } },
    $set: { updatedAt: new Date() }
  })
  const doc = await col.findOne(q)
  if (!Array.isArray(doc?.localServices) || doc.localServices.length === 0) {
    await col.updateOne(q, { $unset: { pendingCoreServicesSync: '' } })
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
    const headers = getCoreApiProxyHeaders()
    const coreResult = await getServicesFromCoreWithRetry(baseUrl, businessId, headers)

    if (coreResult.ok) {
      return NextResponse.json(coreResult.data)
    }

    const doc = await database.collection(BUSINESS_COLLECTION).findOne(businessIdQuery(businessId))
    const local = mapLocalServicesForResponse(doc?.localServices)
    if (local.length > 0) {
      return NextResponse.json({
        ...(typeof coreResult.data === 'object' && coreResult.data ? coreResult.data : {}),
        ok: true,
        services: local,
        source: 'local_pending_sync'
      })
    }

    return NextResponse.json(
      coreResult.data && typeof coreResult.data === 'object'
        ? { ...coreResult.data, ok: false }
        : { ok: false, error: 'Booking service unavailable. Please try again.' },
      {
        status:
          coreResult.res?.status && coreResult.res.status >= 400 ? coreResult.res.status : 502
      }
    )
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
    const headers = getCoreApiProxyHeaders()
    const business = await database.collection(BUSINESS_COLLECTION).findOne(businessIdQuery(businessId))
    const planKey = resolveBusinessPlanKey(business)
    const maxServices = getUiPlanLimits(planKey).maxServices

    const body = await request.json().catch(() => ({}))

    if (maxServices !== -1) {
      const coreListResult = await getServicesFromCoreWithRetry(baseUrl, businessId, headers)
      let count = 0
      if (coreListResult.ok) {
        count = normalizeServicesList(coreListResult.data).length
      } else {
        const doc = await database.collection(BUSINESS_COLLECTION).findOne(businessIdQuery(businessId))
        count = mapLocalServicesForResponse(doc?.localServices).length
      }
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

    const row = normalizeLocalServiceRow(body)
    if (!row) {
      return NextResponse.json({ ok: false, error: 'serviceId required' }, { status: 400 })
    }

    const coreResult = await postServiceToCoreWithRetry(baseUrl, businessId, headers, body)

    if (coreResult.ok) {
      await clearLocalServiceAfterCoreSync(database, businessId, row.serviceId)
      return NextResponse.json(coreResult.data)
    }

    console.warn('[business/services] Booking service POST failed after retries; persisting service on business doc', {
      businessId,
      serviceId: row.serviceId,
      status: coreResult.res?.status
    })

    await upsertLocalServiceRow(database, businessId, row)

    return NextResponse.json({
      ok: true,
      syncedToCore: false,
      service: {
        serviceId: row.serviceId,
        id: row.serviceId,
        name: row.name,
        durationMinutes: row.durationMinutes,
        price: row.price,
        active: row.active,
        currency: row.currency
      },
      message:
        'Service saved. It will apply to your booking line once the account finishes syncing (usually within a minute).'
    })
  } catch (e) {
    console.error('[business/services] POST error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
