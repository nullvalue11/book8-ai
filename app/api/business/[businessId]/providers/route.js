/**
 * GET / POST /api/business/[businessId]/providers
 * Staff providers stored on business.providers (Mongo). Optional core-api sync later.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { normalizePlanKey } from '@/lib/plan-features'
import { canAddProvider, normalizeProviderInput, sanitizeProvidersForPublic } from '@/lib/staff-providers'

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

export async function GET(request, { params }) {
  try {
    const { businessId } = params
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    const list = Array.isArray(auth.business.providers) ? auth.business.providers : []
    const plan = normalizePlanKey(auth.business.plan || auth.business.subscription?.plan)
    return NextResponse.json({
      ok: true,
      providers: list,
      plan,
      maxProviders: plan === 'starter' ? 0 : plan === 'growth' ? 5 : -1,
      publicSample: sanitizeProvidersForPublic(list, plan)
    })
  } catch (e) {
    console.error('[business/providers GET]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const { businessId } = params
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const plan = normalizePlanKey(auth.business.plan || auth.business.subscription?.plan)
    const existing = Array.isArray(auth.business.providers) ? auth.business.providers : []
    if (!canAddProvider(plan, existing.length)) {
      return NextResponse.json(
        { ok: false, error: plan === 'starter' ? 'UPGRADE_REQUIRED' : 'MAX_PROVIDERS' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const normalized = normalizeProviderInput(body, null)
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 })
    }

    const next = [...existing, { ...normalized.provider, sortOrder: existing.length }]
    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { providers: next, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, provider: normalized.provider, providers: next })
  } catch (e) {
    console.error('[business/providers POST]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Server error' }, { status: 500 })
  }
}
