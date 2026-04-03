/**
 * PATCH / DELETE /api/business/[businessId]/providers/[providerId]
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { normalizeProviderInput } from '@/lib/staff-providers'

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
  const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404 }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403 }
  return { business }
}

export async function PATCH(request, { params }) {
  try {
    const { businessId, providerId } = params
    if (!businessId || !providerId) {
      return NextResponse.json({ ok: false, error: 'businessId and providerId required' }, { status: 400 })
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

    let list = Array.isArray(auth.business.providers) ? [...auth.business.providers] : []

    if (body.reorder && Array.isArray(body.reorder)) {
      const order = body.reorder.map(String)
      const map = new Map(list.filter(Boolean).map((p) => [String(p.id), p]))
      const next = []
      for (const id of order) {
        const p = map.get(id)
        if (p) next.push(p)
      }
      for (const p of list) {
        if (p && !order.includes(String(p.id))) next.push(p)
      }
      next.forEach((p, i) => {
        p.sortOrder = i
      })
      await database.collection(COLLECTION_NAME).updateOne(
        { businessId },
        { $set: { providers: next, updatedAt: new Date() } }
      )
      return NextResponse.json({ ok: true, providers: next })
    }

    const idx = list.findIndex((p) => p && String(p.id) === String(providerId))
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 })
    }

    const merged = { ...list[idx], ...body, name: body.name !== undefined ? body.name : list[idx].name }
    const normalized = normalizeProviderInput(merged, list[idx])
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 })
    }

    list[idx] = normalized.provider
    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { providers: list, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, provider: list[idx], providers: list })
  } catch (e) {
    console.error('[business/providers PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { businessId, providerId } = params
    if (!businessId || !providerId) {
      return NextResponse.json({ ok: false, error: 'businessId and providerId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const list = Array.isArray(auth.business.providers) ? [...auth.business.providers] : []
    const idx = list.findIndex((p) => p && String(p.id) === String(providerId))
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 })
    }

    list[idx] = { ...list[idx], active: false }
    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { providers: list, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, providers: list })
  } catch (e) {
    console.error('[business/providers DELETE]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
