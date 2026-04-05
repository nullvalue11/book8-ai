/**
 * GET /api/business/waitlist — all waitlist entries for JWT user's businesses
 * DELETE /api/business/waitlist?entryId= — remove entry (owner only)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { WAITLIST_COLLECTION, sanitizeWaitlistEntryForOwner } from '@/lib/waitlist'

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

async function authUserId(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401, userId: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return { userId: String(payload.sub || '') }
  } catch {
    return { error: 'Invalid or expired token', status: 401, userId: null }
  }
}

function computePositions(waitingRows) {
  const byBiz = new Map()
  for (const r of waitingRows) {
    const bid = r.businessId
    if (!byBiz.has(bid)) byBiz.set(bid, [])
    byBiz.get(bid).push(r)
  }
  for (const [, arr] of byBiz) {
    arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }
  const pos = new Map()
  for (const [, arr] of byBiz) {
    arr.forEach((r, i) => {
      pos.set(r.id, i + 1)
    })
  }
  return pos
}

export async function GET(request) {
  try {
    const auth = await authUserId(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const database = await connect()
    const businesses = await database
      .collection(COLLECTION_NAME)
      .find({ ownerUserId: auth.userId })
      .project({ businessId: 1, name: 1 })
      .toArray()
    const ids = businesses.map((b) => b.businessId).filter(Boolean)
    const nameById = Object.fromEntries(
      businesses.map((b) => [b.businessId, b.name || b.businessId])
    )
    if (!ids.length) {
      return NextResponse.json({ ok: true, entries: [], waitingCount: 0 })
    }
    const rawRows = await database
      .collection(WAITLIST_COLLECTION)
      .find({ businessId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray()

    const rows = rawRows.map((r) => ({
      ...r,
      id:
        r.id != null && String(r.id).trim()
          ? String(r.id).trim()
          : r._id != null
            ? String(r._id)
            : ''
    }))

    const waitingOnly = rows.filter((r) => r.status === 'waiting')
    const positionById = computePositions(waitingOnly)

    const entries = rows.map((r) => {
      const s = sanitizeWaitlistEntryForOwner(r)
      return {
        ...s,
        businessName: nameById[r.businessId] || r.businessId,
        position: r.status === 'waiting' ? positionById.get(r.id) ?? null : null
      }
    })
    const waitingCount = waitingOnly.length

    return NextResponse.json({ ok: true, entries, waitingCount })
  } catch (e) {
    console.error('[business/waitlist GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const auth = await authUserId(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const url = new URL(request.url)
    const entryId = url.searchParams.get('entryId') || ''
    if (!entryId) {
      return NextResponse.json({ ok: false, error: 'entryId required' }, { status: 400 })
    }

    const database = await connect()
    const col = database.collection(WAITLIST_COLLECTION)
    const entry = await col.findOne({ id: entryId })
    if (!entry) {
      return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 })
    }
    const owned = await database.collection(COLLECTION_NAME).findOne({
      businessId: entry.businessId,
      ownerUserId: auth.userId
    })
    if (!owned) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 })
    }
    await col.deleteOne({ id: entryId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[business/waitlist DELETE]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
