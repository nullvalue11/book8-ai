/**
 * GET/POST/PATCH/DELETE /api/business/[businessId]/portfolio
 * Owner-only portfolio CRUD. Tries core-api multipart upload first; falls back to GridFS + Mongo.
 */

import { randomUUID } from 'crypto'
import { Readable } from 'stream'
import { NextResponse } from 'next/server'
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { resolveBusinessPlanKey } from '@/lib/subscription'
import { getUiPlanLimits, normalizePlanKey } from '@/lib/plan-features'
import {
  PORTFOLIO_MAX_FILE_BYTES,
  normalizePortfolioAfterMutation,
  sanitizePortfolioForPublic
} from '@/lib/portfolio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function rawParams(segmentCtx) {
  const p = segmentCtx?.params instanceof Promise ? await segmentCtx.params : segmentCtx?.params
  return p || {}
}

function businessIdQuery(businessId) {
  return { $or: [{ businessId }, { id: businessId }] }
}

async function verifyOwner(request, database, businessId) {
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
  const business = await database.collection(COLLECTION_NAME).findOne(businessIdQuery(businessId))
  if (!business) return { error: 'Business not found', status: 404 }
  if (String(business.ownerUserId || '') !== String(payload.sub || '')) {
    return { error: 'Access denied', status: 403 }
  }
  return { business }
}

function coreHeaders() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  return {
    ...(apiKey && { 'x-book8-api-key': apiKey }),
    ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
  }
}

function maxPhotosForBusiness(business) {
  const planKey = resolveBusinessPlanKey(business)
  const limits = getUiPlanLimits(planKey)
  return limits.maxPortfolioPhotos ?? (normalizePlanKey(planKey) === 'starter' ? 5 : 20)
}

function photoFromCoreResponse(data) {
  if (!data || typeof data !== 'object') return null
  const p = data.photo && typeof data.photo === 'object' ? data.photo : data
  const url = typeof p.url === 'string' ? p.url : typeof data.url === 'string' ? data.url : null
  if (!url) return null
  const id =
    typeof p.id === 'string'
      ? p.id
      : typeof p.photoId === 'string'
        ? p.photoId
        : typeof data.id === 'string'
          ? data.id
          : randomUUID()
  return { id, url }
}

async function tryCoreUpload(businessId, buffer, mime, fileName, caption, category) {
  try {
    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
    const outgoing = new FormData()
    const name = fileName || 'upload'
    const blob = new Blob([buffer], { type: mime || 'application/octet-stream' })
    outgoing.append('file', blob, name)
    if (caption) outgoing.append('caption', caption)
    if (category) outgoing.append('category', category)
    const res = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/portfolio`,
      {
        method: 'POST',
        headers: coreHeaders(),
        body: outgoing,
        cache: 'no-store'
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, status: res.status, data }
    const photo = photoFromCoreResponse(data)
    if (!photo) return { ok: false, status: 502, data }
    return { ok: true, photo }
  } catch {
    return { ok: false, status: 0, data: {} }
  }
}

async function storeGridFs(database, buffer, meta) {
  const bucket = new GridFSBucket(database, { bucketName: 'portfolio_fs' })
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(`portfolio-${meta.photoId}`, { metadata: meta })
    uploadStream.on('error', reject)
    uploadStream.on('finish', () => resolve(uploadStream.id))
    Readable.from(buffer).pipe(uploadStream)
  })
}

function publicPortfolioUrl(photoId) {
  return `/api/public/portfolio-media?pid=${encodeURIComponent(photoId)}`
}

async function deleteGridFsIfAny(database, gridFsIdStr) {
  if (!gridFsIdStr) return
  try {
    const bucket = new GridFSBucket(database, { bucketName: 'portfolio_fs' })
    await bucket.delete(new ObjectId(String(gridFsIdStr)))
  } catch {
    /* ignore missing file */
  }
}

/** GET — owner list (includes gridFsId for admin UI) */
export async function GET(request, segmentCtx) {
  try {
    const { businessId } = await rawParams(segmentCtx)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const list = Array.isArray(auth.business.portfolio) ? auth.business.portfolio : []
    const normalized = normalizePortfolioAfterMutation(list)
    const max = maxPhotosForBusiness(auth.business)
    const planKey = resolveBusinessPlanKey(auth.business)
    return NextResponse.json({
      ok: true,
      photos: normalized,
      publicPhotos: sanitizePortfolioForPublic(list),
      maxPhotos: max,
      planKey: normalizePlanKey(planKey)
    })
  } catch (e) {
    console.error('[portfolio GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** POST — multipart: file, caption?, category? */
export async function POST(request, segmentCtx) {
  try {
    const { businessId } = await rawParams(segmentCtx)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const col = database.collection(COLLECTION_NAME)
    const bid = auth.business.businessId || businessId
    const existing = Array.isArray(auth.business.portfolio) ? [...auth.business.portfolio] : []
    const max = maxPhotosForBusiness(auth.business)
    if (existing.length >= max) {
      return NextResponse.json(
        { ok: false, error: 'Portfolio limit reached for your plan' },
        { status: 400 }
      )
    }

    let form
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid form data' }, { status: 400 })
    }
    const file = form.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 })
    }
    const mime = (file.type || '').toLowerCase().split(';')[0].trim()
    if (!ALLOWED_TYPES.has(mime)) {
      return NextResponse.json(
        { ok: false, error: 'Use PNG, JPG, or WebP' },
        { status: 400 }
      )
    }
    const buf = Buffer.from(await file.arrayBuffer())
    if (buf.length > PORTFOLIO_MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: 'Max file size is 5MB' }, { status: 400 })
    }

    const captionRaw = form.get('caption')
    const categoryRaw = form.get('category')
    const caption =
      typeof captionRaw === 'string' ? captionRaw.trim().slice(0, 200) : ''
    const category =
      typeof categoryRaw === 'string' ? categoryRaw.trim().slice(0, 80) : ''

    let entry = null
    const uploadName = (file.name && String(file.name)) || 'upload'

    const coreTry = await tryCoreUpload(bid, buf, mime, uploadName, caption, category)
    if (coreTry.ok && coreTry.photo) {
      entry = {
        id: coreTry.photo.id,
        url: coreTry.photo.url,
        caption,
        category,
        sortOrder: existing.length
      }
    } else {
      const photoId = randomUUID()
      const gridFsId = await storeGridFs(database, buf, {
        businessId: bid,
        photoId,
        contentType: mime
      })
      entry = {
        id: photoId,
        url: publicPortfolioUrl(photoId),
        caption,
        category,
        sortOrder: existing.length,
        gridFsId: String(gridFsId)
      }
    }

    const next = normalizePortfolioAfterMutation([...existing, entry])
    await col.updateOne(businessIdQuery(bid), {
      $set: { portfolio: next, updatedAt: new Date() }
    })

    return NextResponse.json({ ok: true, photo: entry, photos: next })
  } catch (e) {
    console.error('[portfolio POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

/** DELETE — ?photoId= */
export async function DELETE(request, segmentCtx) {
  try {
    const { businessId } = await rawParams(segmentCtx)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const url = new URL(request.url)
    const photoId = url.searchParams.get('photoId') || ''
    if (!photoId) {
      return NextResponse.json({ ok: false, error: 'photoId required' }, { status: 400 })
    }

    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const col = database.collection(COLLECTION_NAME)
    const bid = auth.business.businessId || businessId
    const existing = Array.isArray(auth.business.portfolio) ? [...auth.business.portfolio] : []
    const victim = existing.find((p) => String(p.id) === photoId)
    if (!victim) {
      return NextResponse.json({ ok: false, error: 'Photo not found' }, { status: 404 })
    }

    const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
    if (baseUrl && !victim.gridFsId) {
      try {
        await fetch(
          `${baseUrl}/api/businesses/${encodeURIComponent(bid)}/portfolio/${encodeURIComponent(photoId)}`,
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...coreHeaders() },
            cache: 'no-store'
          }
        )
      } catch {
        /* non-fatal */
      }
    }

    await deleteGridFsIfAny(database, victim.gridFsId)

    const filtered = existing.filter((p) => String(p.id) !== photoId)
    const next = normalizePortfolioAfterMutation(filtered)
    await col.updateOne(businessIdQuery(bid), {
      $set: { portfolio: next, updatedAt: new Date() }
    })

    return NextResponse.json({ ok: true, photos: next })
  } catch (e) {
    console.error('[portfolio DELETE]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

/** PATCH — JSON { orderedIds: string[] } */
export async function PATCH(request, segmentCtx) {
  try {
    const { businessId } = await rawParams(segmentCtx)
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null
    if (!orderedIds?.length) {
      return NextResponse.json({ ok: false, error: 'orderedIds required' }, { status: 400 })
    }

    const col = database.collection(COLLECTION_NAME)
    const bid = auth.business.businessId || businessId
    const existing = Array.isArray(auth.business.portfolio) ? [...auth.business.portfolio] : []
    const byId = new Map(existing.map((p) => [String(p.id), p]))
    const reordered = []
    for (const id of orderedIds) {
      const p = byId.get(id)
      if (p) reordered.push(p)
    }
    for (const p of existing) {
      if (!orderedIds.includes(String(p.id))) reordered.push(p)
    }
    const next = normalizePortfolioAfterMutation(reordered)
    await col.updateOne(businessIdQuery(bid), {
      $set: { portfolio: next, updatedAt: new Date() }
    })

    return NextResponse.json({ ok: true, photos: next })
  } catch (e) {
    console.error('[portfolio PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
