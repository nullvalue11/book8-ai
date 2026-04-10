/**
 * GET /api/businesses/:businessId/trial-status
 * BOO-98B: Trial / grace / locked state for dashboard banner (book8-ai Mongo only).
 */
import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { computeTrialStatus } from '@/lib/trialStatusShared'

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

export async function GET(request, { params }) {
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

    const database = await connect()
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 401 })
    }

    const business = await database.collection('businesses').findOne({
      ownerUserId: user.id,
      $or: [{ businessId }, { id: businessId }]
    })

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const computed = computeTrialStatus(business, user)
    return NextResponse.json({
      ok: true,
      businessId: business.businessId || business.id,
      ...computed
    })
  } catch (err) {
    console.error('[trial-status]', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
