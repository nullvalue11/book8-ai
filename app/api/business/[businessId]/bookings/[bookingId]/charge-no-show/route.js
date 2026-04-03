/**
 * POST /api/business/[businessId]/bookings/[bookingId]/charge-no-show
 * Manual no-show charge when auto-charge is off.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import {
  sanitizeNoShowForPublic,
  computeNoShowFeeCents
} from '@/lib/no-show-protection'
import { createOffSessionCharge } from '@/lib/no-show-stripe'

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

export async function POST(request, { params }) {
  try {
    const { businessId, bookingId } = params
    if (!businessId || !bookingId) {
      return NextResponse.json({ ok: false, error: 'Missing ids' }, { status: 400 })
    }
    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const pub = sanitizeNoShowForPublic(auth.business)
    if (!pub.enabled) {
      return NextResponse.json({ ok: false, error: 'No-show protection not enabled' }, { status: 400 })
    }

    const booking = await database.collection('bookings').findOne({
      id: bookingId,
      businessId
    })
    if (!booking) {
      return NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 })
    }
    if (booking.noShowStatus !== 'no_show') {
      return NextResponse.json(
        { ok: false, error: 'Mark this booking as no-show first' },
        { status: 400 }
      )
    }
    if (booking.noShowChargeStatus === 'charged') {
      return NextResponse.json({ ok: false, error: 'Already charged' }, { status: 400 })
    }
    if (!booking.stripeCustomerId || !booking.stripePaymentMethodId) {
      return NextResponse.json(
        { ok: false, error: 'No card on file for this booking' },
        { status: 400 }
      )
    }
    if (!env.STRIPE?.SECRET_KEY) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 503 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(env.STRIPE.SECRET_KEY, { apiVersion: '2023-10-16' })
    const cents = computeNoShowFeeCents(pub, booking.servicePriceCents)
    const charge = await createOffSessionCharge(stripe, {
      customerId: booking.stripeCustomerId,
      paymentMethodId: booking.stripePaymentMethodId,
      amountCents: cents,
      currency: pub.currency || 'cad',
      metadata: { bookingId, businessId, type: 'no_show_manual' }
    })

    if (!charge.ok) {
      return NextResponse.json(
        { ok: false, error: charge.error || 'Charge failed' },
        { status: 402 }
      )
    }
    if (charge.skipped) {
      return NextResponse.json({ ok: true, skipped: true, booking })
    }

    const now = new Date().toISOString()
    await database.collection('bookings').updateOne(
      { id: bookingId, businessId },
      {
        $set: {
          noShowChargeStatus: 'charged',
          noShowChargedAt: now,
          noShowChargeAmountCents: charge.amountCents,
          noShowPaymentIntentId: charge.paymentIntentId,
          updatedAt: now
        }
      }
    )

    const updated = await database.collection('bookings').findOne({ id: bookingId, businessId })
    return NextResponse.json({ ok: true, booking: updated })
  } catch (e) {
    console.error('[charge-no-show]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
