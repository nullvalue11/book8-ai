/**
 * POST /api/business/:businessId/start-growth-trial
 * BOO-98B: Start 14-day Growth trial without Stripe (cardless).
 *
 * DEPRECATED 2026-05-02 (BOO-TRIAL-GATE-1B) — setup wizard now uses Stripe Checkout for Growth.
 * Safe to delete after ~30 days if no callers remain.
 */
import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

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

export async function POST(request, { params }) {
  try {
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 })
    }

    let payload
    try {
      payload = jwt.verify(token, env.JWT_SECRET)
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 })
    }

    const { businessId } = params
    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const priceGrowth = env.STRIPE?.PRICE_GROWTH
    if (!priceGrowth) {
      return NextResponse.json({ ok: false, error: 'Growth plan not configured' }, { status: 503 })
    }

    const trialDays = env.TRIAL_PERIOD_DAYS ?? 14
    const graceDays = env.TRIAL_GRACE_DAYS ?? 7

    const database = await connect()
    const collection = database.collection('businesses')

    const business = await collection.findOne({
      ownerUserId: payload.sub,
      $or: [{ businessId }, { id: businessId }]
    })

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const bid = business.businessId || business.id

    if (business.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ ok: false, error: 'Business already has a paid subscription' }, { status: 400 })
    }

    const existingSub = business.subscription || {}
    if (
      existingSub.trialSource === 'cardless_growth' &&
      existingSub.trialEnd &&
      new Date(existingSub.trialEnd) > new Date()
    ) {
      return NextResponse.json({
        ok: true,
        businessId: bid,
        alreadyActive: true,
        trialEndsAt: existingSub.trialEnd,
        graceEndsAt: existingSub.trialGraceEndsAt || null
      })
    }

    const now = new Date()
    const trialEnd = new Date(now.getTime() + trialDays * 86400000)
    const graceEnd = new Date(trialEnd.getTime() + graceDays * 86400000)

    await collection.updateOne(
      { _id: business._id },
      {
        $set: {
          plan: 'growth',
          'subscription.status': 'trialing',
          'subscription.plan': 'growth',
          'subscription.stripePriceId': priceGrowth,
          'subscription.stripeCustomerId': null,
          'subscription.stripeSubscriptionId': null,
          'subscription.trialStart': now.toISOString(),
          'subscription.trialEnd': trialEnd.toISOString(),
          'subscription.trialGraceEndsAt': graceEnd.toISOString(),
          'subscription.trialSource': 'cardless_growth',
          updatedAt: now
        }
      }
    )

    return NextResponse.json({
      ok: true,
      businessId: bid,
      trialEndsAt: trialEnd.toISOString(),
      graceEndsAt: graceEnd.toISOString()
    })
  } catch (err) {
    console.error('[start-growth-trial]', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
