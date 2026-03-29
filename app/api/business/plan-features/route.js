import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import {
  getPlanFeatures,
  getPlanName,
  getUiPlanLimits,
  normalizePlanKey
} from '@/lib/plan-features'

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

export async function GET(request) {
  try {
    const database = await connect()
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing Authorization header' }, { status: 401 })
    }

    let userId
    try {
      const payload = jwt.verify(token, env.JWT_SECRET)
      userId = payload.sub
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 401 })
    }

    const url = new URL(request.url)
    const businessIdParam = url.searchParams.get('businessId')

    let business = null
    if (businessIdParam) {
      business = await database.collection(BUSINESS_COLLECTION).findOne({
        ownerUserId: userId,
        $or: [{ businessId: businessIdParam }, { id: businessIdParam }]
      })
    } else {
      business = await database
        .collection(BUSINESS_COLLECTION)
        .find({ ownerUserId: userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next()
    }

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const plan = normalizePlanKey(business.plan || business.subscription?.plan)
    const features = getPlanFeatures(plan)
    const name = getPlanName(plan)

    return NextResponse.json({
      ok: true,
      businessId: business.businessId || business.id,
      plan,
      planName: name,
      features,
      planLimits: getUiPlanLimits(plan)
    })
  } catch (e) {
    console.error('[business/plan-features]', e)
    return NextResponse.json({ ok: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
