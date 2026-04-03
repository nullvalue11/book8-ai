/**
 * Proxy to core-api for bookings by business.
 * GET /api/business/[businessId]/bookings
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

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

async function verifyAuthAndOwnership(request, database, businessId) {
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
  const business = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
  if (!business) return { error: 'Business not found', status: 404 }
  if (business.ownerUserId !== payload.sub) return { error: 'Access denied', status: 403 }
  return { payload }
}

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const { businessId } = params
    const authResult = await verifyAuthAndOwnership(request, database, businessId)
    if (authResult.error) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authResult.status })
    }

    const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
    const apiKey = env.BOOK8_CORE_API_KEY || ''
    const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

    const res = await fetch(
      `${baseUrl}/api/bookings?businessId=${encodeURIComponent(businessId)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-book8-api-key': apiKey }),
          ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
        },
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ ok: true, bookings: [] })
      }
      console.error('[business/bookings] core-api error:', res.status)
      return NextResponse.json({ ok: true, bookings: [] })
    }

    const data = await res.json().catch(() => ({}))
    let bookings = Array.isArray(data?.bookings) ? data.bookings : Array.isArray(data) ? data : []
    if (!Array.isArray(bookings)) bookings = []

    // Merge `language` from local Mongo bookings (web flow stores here; core-api list may omit it)
    try {
      const business = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
      const ownerId = business?.ownerUserId
      if (ownerId) {
        const locals = await database
          .collection('bookings')
          .find({
            $or: [{ businessId }, { userId: ownerId }]
          })
          .project({ id: 1, language: 1, startTime: 1, guestEmail: 1 })
          .limit(500)
          .toArray()
        const byId = new Map(locals.map((b) => [b.id, b.language]))
        const byStartEmail = new Map(
          locals
            .filter((b) => b.startTime && b.guestEmail)
            .map((b) => [`${new Date(b.startTime).toISOString()}|${String(b.guestEmail).toLowerCase()}`, b.language])
        )
        for (const b of bookings) {
          if (b.language) continue
          const id = b.id || b.bookingId
          if (id && byId.has(id)) {
            b.language = byId.get(id)
            continue
          }
          const slot = b.slot || {}
          const st = slot.start || b.startTime
          const em = (b.customer?.email || b.guestEmail || '').toLowerCase()
          if (st && em) {
            const k = `${new Date(st).toISOString()}|${em}`
            if (byStartEmail.has(k)) b.language = byStartEmail.get(k)
          }
        }

        const localsExtra = await database
          .collection('bookings')
          .find({ businessId })
          .project({
            id: 1,
            startTime: 1,
            guestEmail: 1,
            noShowStatus: 1,
            noShowMarkedAt: 1,
            noShowChargeStatus: 1,
            noShowChargedAt: 1,
            noShowChargeAmountCents: 1,
            noShowChargeError: 1,
            paymentMethodSummary: 1,
            stripePaymentMethodId: 1,
            stripeCustomerId: 1,
            cancellationFeeChargedAt: 1,
            cancellationFeeCents: 1,
            servicePriceCents: 1,
            noShowPolicySnapshot: 1
          })
          .limit(500)
          .toArray()
        const mergeNoShow = (target, src) => {
          if (!src) return
          const fields = [
            'noShowStatus',
            'noShowMarkedAt',
            'noShowChargeStatus',
            'noShowChargedAt',
            'noShowChargeAmountCents',
            'noShowChargeError',
            'paymentMethodSummary',
            'stripePaymentMethodId',
            'stripeCustomerId',
            'cancellationFeeChargedAt',
            'cancellationFeeCents',
            'servicePriceCents',
            'noShowPolicySnapshot'
          ]
          for (const f of fields) {
            if (src[f] !== undefined) target[f] = src[f]
          }
        }
        const byIdExtra = new Map(localsExtra.map((x) => [x.id, x]))
        const byStartEmailExtra = new Map(
          localsExtra
            .filter((x) => x.startTime && x.guestEmail)
            .map((x) => [
              `${new Date(x.startTime).toISOString()}|${String(x.guestEmail).toLowerCase()}`,
              x
            ])
        )
        for (const b of bookings) {
          const id = b.id || b.bookingId
          let src = id && byIdExtra.has(id) ? byIdExtra.get(id) : null
          if (!src) {
            const slot = b.slot || {}
            const st = slot.start || b.startTime
            const em = (b.customer?.email || b.guestEmail || '').toLowerCase()
            if (st && em) {
              const k = `${new Date(st).toISOString()}|${em}`
              if (byStartEmailExtra.has(k)) src = byStartEmailExtra.get(k)
            }
          }
          mergeNoShow(b, src)
        }
      }
    } catch (e) {
      console.warn('[business/bookings] language merge skipped:', e?.message)
    }

    return NextResponse.json({ ok: true, bookings })
  } catch (err) {
    console.error('[business/bookings] Error:', err)
    return NextResponse.json({ ok: true, bookings: [] })
  }
}
