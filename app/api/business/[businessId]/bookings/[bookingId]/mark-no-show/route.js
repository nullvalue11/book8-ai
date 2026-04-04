/**
 * PATCH /api/business/[businessId]/bookings/[bookingId]/mark-no-show
 * QA-009: Voice/SMS bookings live in core-api — try core first, then Mongo fallback for web bookings.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { sanitizeNoShowForPublic, computeNoShowFeeCents } from '@/lib/no-show-protection'
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

async function resolveIds(rawParams) {
  const p = rawParams instanceof Promise ? await rawParams : rawParams
  let businessId = p?.businessId
  let bookingId = p?.bookingId
  if (businessId != null && typeof businessId === 'string') {
    try {
      businessId = decodeURIComponent(businessId.trim())
    } catch {
      businessId = String(businessId).trim()
    }
  }
  if (bookingId != null && typeof bookingId === 'string') {
    try {
      bookingId = decodeURIComponent(bookingId.trim())
    } catch {
      bookingId = String(bookingId).trim()
    }
  }
  return { businessId, bookingId }
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

function getCoreMarkNoShowConfig() {
  const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  if (!baseUrl || (!secret && !apiKey)) return null
  return { baseUrl, secret, apiKey }
}

async function proxyMarkNoShowToCore(bookingId, businessId) {
  const cfg = getCoreMarkNoShowConfig()
  if (!cfg) return null
  const url = `${cfg.baseUrl}/api/bookings/${encodeURIComponent(bookingId)}/mark-no-show`
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey && { 'x-book8-api-key': cfg.apiKey }),
        ...(cfg.secret && { 'x-book8-internal-secret': cfg.secret })
      },
      body: JSON.stringify({ businessId }),
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  } catch (e) {
    console.warn('[mark-no-show] core proxy failed', e?.message || e)
    return null
  }
}

async function markNoShowLocal(database, auth, bookingId, businessId) {
  const pub = sanitizeNoShowForPublic(auth.business)

  const booking = await database.collection('bookings').findOne({
    id: bookingId,
    businessId
  })
  if (!booking) {
    return { response: NextResponse.json({ ok: false, error: 'Booking not found' }, { status: 404 }) }
  }
  if (booking.status === 'canceled') {
    return { response: NextResponse.json({ ok: false, error: 'Booking is canceled' }, { status: 400 }) }
  }
  if (booking.noShowStatus === 'no_show') {
    return { response: NextResponse.json({ ok: false, error: 'Already marked as no-show' }, { status: 400 }) }
  }

  const autoCharge = auth.business.noShowProtection?.autoCharge !== false
  const markedAt = new Date().toISOString()
  let chargeResult = null

  if (
    autoCharge &&
    booking.stripeCustomerId &&
    booking.stripePaymentMethodId &&
    env.STRIPE?.SECRET_KEY
  ) {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(env.STRIPE.SECRET_KEY, { apiVersion: '2023-10-16' })
    const cents = computeNoShowFeeCents(pub, booking.servicePriceCents)
    chargeResult = await createOffSessionCharge(stripe, {
      customerId: booking.stripeCustomerId,
      paymentMethodId: booking.stripePaymentMethodId,
      amountCents: cents,
      currency: pub.currency || 'cad',
      metadata: { bookingId, businessId, type: 'no_show' }
    })
  }

  const set = {
    noShowStatus: 'no_show',
    noShowMarkedAt: markedAt,
    updatedAt: markedAt
  }
  if (chargeResult?.ok && chargeResult.paymentIntentId) {
    set.noShowChargeStatus = 'charged'
    set.noShowChargedAt = markedAt
    set.noShowChargeAmountCents = chargeResult.amountCents
    set.noShowPaymentIntentId = chargeResult.paymentIntentId
  } else if (chargeResult && !chargeResult.ok) {
    set.noShowChargeStatus = 'charge_failed'
    set.noShowChargeError = chargeResult.error || 'Charge failed'
  } else if (!autoCharge) {
    set.noShowChargeStatus = 'pending_manual'
  } else {
    set.noShowChargeStatus = 'pending_manual'
  }

  await database.collection('bookings').updateOne({ id: bookingId, businessId }, { $set: set })

  const updated = await database.collection('bookings').findOne({ id: bookingId, businessId })
  return {
    response: NextResponse.json({ ok: true, booking: updated, charge: chargeResult })
  }
}

export async function PATCH(request, ctx) {
  try {
    const { businessId, bookingId } = await resolveIds(ctx.params)
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
      return NextResponse.json(
        { ok: false, error: 'No-show protection is not enabled for this business' },
        { status: 400 }
      )
    }

    const core = await proxyMarkNoShowToCore(bookingId, businessId)
    if (core?.res?.ok) {
      return NextResponse.json(
        core.data && typeof core.data === 'object' && Object.keys(core.data).length
          ? core.data
          : { ok: true }
      )
    }
    if (core?.res && ![404, 408, 502, 503, 504].includes(core.res.status)) {
      const errBody =
        core.data && typeof core.data === 'object'
          ? core.data
          : { ok: false, error: 'Booking service error' }
      return NextResponse.json(errBody, { status: core.res.status >= 400 ? core.res.status : 502 })
    }

    const local = await markNoShowLocal(database, auth, bookingId, businessId)
    return local.response
  } catch (e) {
    console.error('[mark-no-show]', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
