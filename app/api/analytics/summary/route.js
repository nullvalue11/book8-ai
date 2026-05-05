import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { corsHeaders } from '@/lib/cors-allow'
import { isSubscribed } from '@/lib/subscription'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { currencyFromTimezone } from '@/lib/currency'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 60 // Cache for 60 seconds

let client, db

// Subscription required error
function subscriptionRequiredResponse(feature) {
  return NextResponse.json({
    ok: false,
    error: 'Subscription required',
    code: 'SUBSCRIPTION_REQUIRED',
    feature: feature,
    message: `An active subscription is required to access ${feature} features. Please subscribe at /pricing`
  }, { status: 402 })
}

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function requireAuth(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const database = await connect()
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

function normalizeList(raw) {
  if (Array.isArray(raw?.services)) return raw.services
  if (Array.isArray(raw?.bookings)) return raw.bookings
  if (Array.isArray(raw)) return raw
  return []
}

function derivePriceCents(row) {
  if (row?.priceCents != null) {
    const n = Math.round(Number(row.priceCents))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  if (row?.priceAmount != null) {
    const n = Number(row.priceAmount)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n * 100))
  }
  if (row?.price != null) {
    if (typeof row.price === 'number' && Number.isFinite(row.price)) {
      return Math.max(0, Math.round(row.price * 100))
    }
    const str = String(row.price).trim().replace(/^\$/, '')
    const n = parseFloat(str)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n * 100))
  }
  return 0
}

function bookingPriceCents(booking, servicesById) {
  if (booking?.servicePriceCents != null && Number.isFinite(Number(booking.servicePriceCents))) {
    return Math.max(0, Math.floor(Number(booking.servicePriceCents)))
  }
  if (booking?.servicePrice != null) {
    // Support legacy dollars on some rows.
    const n = Number(booking.servicePrice)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n * 100))
  }
  const sid = booking?.serviceId ?? booking?.service?.id ?? booking?.service?.serviceId
  if (sid != null) {
    const key = String(sid).trim()
    const found = servicesById.get(key)
    if (found != null) return Math.max(0, Math.floor(Number(found) || 0))
  }
  return 0
}

function toZonedMonthBoundaryUtc(nowUtc, timeZone) {
  // Compute month boundaries in business timezone, then convert to UTC for comparisons.
  if (!utcToZonedTime || !zonedTimeToUtc) {
    // Fallback to server month boundaries (not ideal, but avoids crashing).
    const now = new Date(nowUtc)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { startOfMonth, startOfPrevMonth, endOfPrevMonth }
  }

  const zonedNow = utcToZonedTime(new Date(nowUtc), timeZone)
  const startZ = new Date(zonedNow.getFullYear(), zonedNow.getMonth(), 1, 0, 0, 0, 0)
  const startPrevZ = new Date(zonedNow.getFullYear(), zonedNow.getMonth() - 1, 1, 0, 0, 0, 0)
  const endPrevZ = new Date(zonedNow.getFullYear(), zonedNow.getMonth(), 0, 23, 59, 59, 999)
  return {
    startOfMonth: zonedTimeToUtc(startZ, timeZone),
    startOfPrevMonth: zonedTimeToUtc(startPrevZ, timeZone),
    endOfPrevMonth: zonedTimeToUtc(endPrevZ, timeZone)
  }
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
  })
}

export async function GET(request) {
  const startTime = Date.now()
  
  try {
    const database = await connect()
    const auth = await requireAuth(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }
    
    // Check subscription
    if (!isSubscribed(auth.user)) {
      return subscriptionRequiredResponse('analytics')
    }
    
    const userId = auth.user.id
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '7d'

    // Parse range (7d, 30d, etc.)
    const daysMatch = range.match(/(\d+)d/)
    const days = daysMatch ? parseInt(daysMatch[1]) : 7

    // Date range
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    // Primary business for this user (source: local MongoDB)
    const businesses = await database
      .collection(BUSINESS_COLLECTION)
      .find({ ownerUserId: userId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()
    const primaryBiz = businesses[0] || null
    const businessId = primaryBiz?.businessId || null
    const businessTimeZone = primaryBiz?.timezone || primaryBiz?.timeZone || null
    const revenueCurrency = (primaryBiz?.currency || currencyFromTimezone(businessTimeZone) || 'USD')
      .toString()
      .toUpperCase()
      .slice(0, 3) || 'USD'

    let bookings = []
    let calls = []
    let services = []
    const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
    const apiKey = env.BOOK8_CORE_API_KEY || ''
    const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

    if (businessId) {
      try {
        const coreHeaders = {
          'Content-Type': 'application/json',
          ...(apiKey && { 'x-book8-api-key': apiKey }),
          ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
        }
        const [bookingsRes, callsRes, servicesRes] = await Promise.all([
          fetch(`${baseUrl}/api/bookings?businessId=${encodeURIComponent(businessId)}`, {
            headers: coreHeaders,
            cache: 'no-store'
          }).then(r => r.json().catch(() => ({}))),
          fetch(`${baseUrl}/internal/calls/by-business/${businessId}?limit=500`, {
            headers: coreHeaders,
            cache: 'no-store'
          }).then(r => r.json().catch(() => ({}))),
          fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services`, {
            headers: coreHeaders,
            cache: 'no-store'
          }).then(r => r.json().catch(() => ({})))
        ])
        bookings = normalizeList(bookingsRes)
        calls = Array.isArray(callsRes?.calls) ? callsRes.calls : normalizeList(callsRes)
        services = normalizeList(servicesRes)
      } catch (e) {
        console.error('[analytics/summary] core-api fetch error:', e)
      }
    }

    // Filter bookings by created/slot date in range
    const bookingsInRange = bookings.filter(b => {
      const created = b.createdAt || b.slot?.start || b.startTime
      if (!created) return false
      const d = new Date(created).toISOString()
      return d >= startISO && d <= endISO
    })

    const totalBookings = bookingsInRange.length
    const reschedules = bookingsInRange.filter(b => (b.rescheduleCount || 0) > 0).length
    const cancellations = bookingsInRange.filter(b => b.status === 'canceled').length
    const callsInRange = calls.filter(c => {
      const t = c.startTime || c.createdAt
      if (!t) return false
      const d = new Date(t).toISOString()
      return d >= startISO && d <= endISO
    })
    const totalCalls = callsInRange.length

    // Revenue captured this month (business timezone)
    const tz = typeof businessTimeZone === 'string' && businessTimeZone.trim() ? businessTimeZone.trim() : 'UTC'
    const { startOfMonth, startOfPrevMonth, endOfPrevMonth } = toZonedMonthBoundaryUtc(Date.now(), tz)

    const servicesById = new Map()
    let anyServicePrice = false
    services.forEach((s) => {
      const sid = String(s?.serviceId ?? s?.id ?? '').trim()
      if (!sid) return
      const cents = derivePriceCents(s)
      servicesById.set(sid, cents)
      if (cents > 0) anyServicePrice = true
    })

    function bookingCreatedAtMs(b) {
      const created = b?.createdAt || b?.created_at || b?.created || b?.slot?.createdAt
      if (!created) return null
      const ms = new Date(created).getTime()
      return Number.isFinite(ms) ? ms : null
    }

    function isCanceled(b) {
      const st = String(b?.status || '').toLowerCase()
      return st === 'canceled' || st === 'cancelled'
    }

    const monthBookings = bookings.filter((b) => {
      if (isCanceled(b)) return false
      const ms = bookingCreatedAtMs(b)
      if (ms == null) return false
      return ms >= startOfMonth.getTime()
    })

    const prevMonthBookings = bookings.filter((b) => {
      if (isCanceled(b)) return false
      const ms = bookingCreatedAtMs(b)
      if (ms == null) return false
      return ms >= startOfPrevMonth.getTime() && ms <= endOfPrevMonth.getTime()
    })

    const thisMonthRevenueCents = monthBookings.reduce((sum, b) => sum + bookingPriceCents(b, servicesById), 0)
    const prevMonthRevenueCents = prevMonthBookings.reduce((sum, b) => sum + bookingPriceCents(b, servicesById), 0)

    const pricesConfigured = anyServicePrice || thisMonthRevenueCents > 0 || prevMonthRevenueCents > 0

    let totalLeadTime = 0
    let leadTimeCount = 0
    bookingsInRange.forEach(booking => {
      const created = booking.createdAt || booking.slot?.start
      const start = booking.slot?.start || booking.startTime
      if (created && start) {
        const createdD = new Date(created)
        const startD = new Date(start)
        const diffMs = startD - createdD
        if (diffMs > 0) {
          totalLeadTime += diffMs / (1000 * 60)
          leadTimeCount++
        }
      }
    })
    const avgLeadTimeMinutes = leadTimeCount > 0 ? Math.round(totalLeadTime / leadTimeCount) : 0

    const remindersSent = 0

    const seriesMap = new Map()
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      seriesMap.set(dateStr, {
        date: dateStr,
        bookings: 0,
        reschedules: 0,
        cancellations: 0,
        reminders_sent: 0
      })
    }

    bookingsInRange.forEach(booking => {
      const created = booking.createdAt || booking.slot?.start
      if (!created) return
      const dateStr = new Date(created).toISOString().split('T')[0]
      if (seriesMap.has(dateStr)) {
        const day = seriesMap.get(dateStr)
        day.bookings++
        if (booking.status === 'canceled') day.cancellations++
        if ((booking.rescheduleCount || 0) > 0) day.reschedules++
      }
    })

    const series = Array.from(seriesMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    
    const queryTime = Date.now() - startTime
    
    return NextResponse.json({
      ok: true,
      range,
      kpis: {
        bookings: totalBookings,
        reschedules,
        cancellations,
        reminders_sent: remindersSent,
        avg_lead_time_minutes: avgLeadTimeMinutes,
        calls: totalCalls
      },
      revenueCaptured: {
        // Primary numbers: dollars (rounded) for simple display, plus cents for accurate formatting.
        thisMonth: Math.round(thisMonthRevenueCents / 100),
        previousMonth: Math.round(prevMonthRevenueCents / 100),
        thisMonthCents: Math.round(thisMonthRevenueCents),
        previousMonthCents: Math.round(prevMonthRevenueCents),
        bookingCount: monthBookings.length,
        pricesConfigured,
        currency: revenueCurrency,
        timeZone: tz
      },
      series,
      meta: {
        query_time_ms: queryTime,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }
    })
    
  } catch (error) {
    console.error('[analytics] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
