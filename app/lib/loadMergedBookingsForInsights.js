/**
 * Load core + Mongo bookings for insights (same merge strategy as /api/business/.../bookings).
 */

import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { getBookingStartMs } from '@/lib/bookingListUtils'

/**
 * @param {import('mongodb').Db} database
 * @param {string} businessId
 * @returns {Promise<object[]>}
 */
export async function loadMergedBookingsForInsights(database, businessId) {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

  let bookings = []
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

  if (res.ok) {
    const data = await res.json().catch(() => ({}))
    bookings = Array.isArray(data?.bookings) ? data.bookings : Array.isArray(data) ? data : []
  }

  if (!Array.isArray(bookings)) bookings = []

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
        .limit(800)
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
          customerName: 1,
          serviceId: 1,
          serviceName: 1,
          status: 1,
          language: 1,
          servicePriceCents: 1,
          service: 1
        })
        .limit(800)
        .toArray()

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
        if (src) {
          if (src.servicePriceCents != null && b.servicePriceCents == null) {
            b.servicePriceCents = src.servicePriceCents
          }
          if (src.language && !b.language) b.language = src.language
        }
      }

      const localsAll = await database.collection('bookings').find({ businessId }).limit(400).toArray()
      const seen = new Set(bookings.map((b) => String(b.id || b.bookingId || '').trim()).filter(Boolean))
      for (const lb of localsAll) {
        const lid = lb.id != null ? String(lb.id) : ''
        if (!lid || seen.has(lid)) continue
        const st = (lb.status || 'confirmed').toLowerCase()
        if (st === 'canceled' || st === 'cancelled') continue
        if (
          getBookingStartMs({
            slot: lb.slot || { start: lb.startTime, end: lb.endTime },
            startTime: lb.startTime,
            start: lb.start
          }) == null
        ) {
          continue
        }
        seen.add(lid)
        bookings.push({
          id: lb.id,
          bookingId: lb.id,
          slot: { start: lb.startTime, end: lb.endTime },
          startTime: lb.startTime,
          endTime: lb.endTime,
          customer: {
            name: lb.customerName,
            email: lb.guestEmail,
            phone: lb.guestPhone
          },
          customerName: lb.customerName,
          serviceId: lb.serviceId,
          serviceName: lb.serviceName,
          service: lb.service,
          servicePriceCents: lb.servicePriceCents,
          status: lb.status || 'confirmed',
          language: lb.language
        })
      }
    }
  } catch (e) {
    console.warn('[insights] booking merge skipped:', e?.message)
  }

  return bookings
}

/**
 * @param {string} businessId
 * @returns {Promise<object[]>}
 */
export async function loadCallsForInsights(businessId) {
  const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  try {
    const res = await fetch(
      `${baseUrl}/internal/calls/by-business/${encodeURIComponent(businessId)}?limit=2000`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-book8-api-key': apiKey }),
          ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
        },
        cache: 'no-store'
      }
    )
    if (!res.ok) return []
    const data = await res.json().catch(() => ({}))
    return Array.isArray(data?.calls) ? data.calls : Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Normalize business.localSchedule.weeklyHours to mon..sun segments */
export function normalizeWeeklyHoursForInsights(business) {
  const raw =
    business?.localSchedule?.weeklyHours ||
    business?.workingHours ||
    business?.schedule?.weeklyHours ||
    null
  if (!raw || typeof raw !== 'object') return null
  const dayMap = {
    sunday: 'sun',
    sun: 'sun',
    monday: 'mon',
    mon: 'mon',
    tuesday: 'tue',
    tue: 'tue',
    wednesday: 'wed',
    wed: 'wed',
    thursday: 'thu',
    thu: 'thu',
    friday: 'fri',
    fri: 'fri',
    saturday: 'sat',
    sat: 'sat'
  }
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    const canon = dayMap[String(k).toLowerCase()] || String(k).toLowerCase().slice(0, 3)
    if (Array.isArray(v) && v.length) {
      out[canon] = v
    } else if (v && typeof v === 'object' && v.start && v.end) {
      out[canon] = [{ start: v.start, end: v.end }]
    }
  }
  return Object.keys(out).length ? out : null
}
