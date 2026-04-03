import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { isValidIanaTimeZone } from '@/lib/timezones'
import { normalizePrimaryLanguage } from '@/lib/primary-languages'
import { syncTimezoneToCore } from '@/lib/sync-calendar-to-core'
import { getPlanFeatures } from '@/lib/plan-features'
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

async function verifyAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { payload: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return { payload }
  } catch {
    return { payload: null }
  }
}

export async function POST(request) {
  try {
    const database = await connect()
    const { payload } = await verifyAuth(request, database)

    if (!payload?.sub) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const {
      businessId: inputBusinessId,
      timezone,
      primaryLanguage: bodyPrimaryLanguage,
      multilingualEnabled: bodyMultilingual
    } = body || {}
    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json({ ok: false, error: 'timezone is required' }, { status: 400 })
    }

    const tz = timezone.trim()
    if (!isValidIanaTimeZone(tz)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid IANA timezone' },
        { status: 400 }
      )
    }

    let business
    if (inputBusinessId) {
      business = await database.collection(BUSINESS_COLLECTION).findOne({
        $or: [{ businessId: inputBusinessId }, { id: inputBusinessId }],
        ownerUserId: payload.sub
      })
    } else {
      business = await database
        .collection(BUSINESS_COLLECTION)
        .find({ ownerUserId: payload.sub })
        .sort({ createdAt: -1 })
        .limit(1)
        .next()
    }

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const bid = business.businessId || business.id

    const planKey = resolveBusinessPlanKey(business)
    const multilingualCapable = !!getPlanFeatures(planKey).multilingual

    const primaryLanguage = normalizePrimaryLanguage(
      typeof bodyPrimaryLanguage === 'string' && bodyPrimaryLanguage.trim()
        ? bodyPrimaryLanguage
        : business.primaryLanguage
    )
    let multilingualEnabled =
      typeof bodyMultilingual === 'boolean'
        ? bodyMultilingual
        : business.multilingualEnabled !== false
    if (!multilingualCapable) multilingualEnabled = false

    await database.collection(BUSINESS_COLLECTION).updateOne(
      {
        $or: [{ businessId: bid }, { id: bid }],
        ownerUserId: payload.sub
      },
      {
        $set: {
          timezone: tz,
          primaryLanguage,
          multilingualEnabled,
          updatedAt: new Date()
        }
      }
    )

    const coreSync = await syncTimezoneToCore({
      businessId: bid,
      timezone: tz,
      primaryLanguage,
      multilingualEnabled
    })

    return NextResponse.json({
      ok: true,
      businessId: bid,
      timezone: tz,
      primaryLanguage,
      multilingualEnabled,
      bookingEngineSync: coreSync
    })
  } catch (err) {
    console.error('[business/update-settings]', err)
    return NextResponse.json(
      { ok: false, error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
