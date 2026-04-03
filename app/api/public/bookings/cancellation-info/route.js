/**
 * GET /api/public/bookings/cancellation-info?token=
 * Late-cancel fee preview (BOO-45B).
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyCancelToken } from '@/lib/security/resetToken'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import {
  cancellationFeeApplies,
  computeNoShowFeeCents,
  formatMoneyAmount
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

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 })
    }
    const verification = verifyCancelToken(token)
    if (!verification.valid) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 })
    }

    const database = await connect()
    const booking = await database.collection('bookings').findOne({
      cancelToken: token,
      status: { $ne: 'canceled' }
    })
    if (!booking) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 })
    }

    if (!booking.businessId) {
      return NextResponse.json({
        ok: true,
        feeApplies: false,
        policy: null,
        feeCents: 0,
        feeDisplay: null,
        last4: null
      })
    }

    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      businessId: booking.businessId
    })
    if (!business) {
      return NextResponse.json({
        ok: true,
        feeApplies: false,
        policy: null,
        feeCents: 0,
        feeDisplay: null,
        last4: null
      })
    }

    const { applies, policy } = cancellationFeeApplies(booking, business)
    const feeCents = policy ? computeNoShowFeeCents(policy, booking.servicePriceCents) : 0
    const feeDisplay =
      applies && policy && feeCents > 0
        ? formatMoneyAmount(feeCents, policy.currency)
        : null
    const last4 = booking.paymentMethodSummary?.last4 || null

    return NextResponse.json({
      ok: true,
      feeApplies: applies && feeCents > 0,
      policy: applies && policy ? { cancellationWindowHours: policy.cancellationWindowHours } : null,
      feeCents,
      feeDisplay,
      last4,
      currency: policy?.currency || 'cad'
    })
  } catch (e) {
    console.error('[cancellation-info]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
