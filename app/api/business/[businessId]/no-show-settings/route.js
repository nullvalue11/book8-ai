/**
 * GET / PATCH /api/business/[businessId]/no-show-settings
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { normalizePlanKey } from '@/lib/plan-features'
import {
  canUseNoShowProtectionPlan,
  normalizeNoShowSettings
} from '@/lib/no-show-protection'

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
    const plan = normalizePlanKey(auth.business.plan || auth.business.subscription?.plan)
    const allowed = canUseNoShowProtectionPlan(plan)
    const raw = auth.business.noShowProtection && typeof auth.business.noShowProtection === 'object'
      ? auth.business.noShowProtection
      : {}
    const settings = normalizeNoShowSettings(raw, raw)
    return NextResponse.json({
      ok: true,
      plan,
      allowed,
      settings: allowed ? settings : { ...settings, enabled: false }
    })
  } catch (e) {
    console.error('[no-show-settings GET]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
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
    if (!canUseNoShowProtectionPlan(plan)) {
      return NextResponse.json(
        { ok: false, error: 'UPGRADE_REQUIRED', message: 'Growth or Enterprise required' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const existing = auth.business.noShowProtection || {}
    const next = normalizeNoShowSettings(body, existing)

    await database.collection(COLLECTION_NAME).updateOne(
      { businessId },
      { $set: { noShowProtection: next, updatedAt: new Date() } }
    )

    return NextResponse.json({ ok: true, settings: next })
  } catch (e) {
    console.error('[no-show-settings PATCH]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
