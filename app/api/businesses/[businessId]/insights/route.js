/**
 * GET /api/businesses/:businessId/insights — BOO-101B (no plan gating).
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { getBookingStartMs } from '@/lib/bookingListUtils'
import {
  currentMonthInTz,
  summarizeMonthBookings,
  buildDailyTrend,
  topServicesThisMonth,
  buildHourHeatmap,
  countCallsInRange,
  countAfterHoursCalls,
  isCompletedBookingForInsights,
  monthRangeUtcInTz
} from '@/lib/insightsAggregation'
import {
  loadMergedBookingsForInsights,
  loadCallsForInsights,
  normalizeWeeklyHoursForInsights
} from '@/lib/loadMergedBookingsForInsights'

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
  let payload
  try {
    payload = jwt.verify(token, env.JWT_SECRET)
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
  const business = await database.collection(BUSINESS_COLLECTION).findOne({
    $or: [{ businessId }, { id: businessId }],
    ownerUserId: payload.sub
  })
  if (!business) {
    const any = await database.collection(BUSINESS_COLLECTION).findOne({ businessId })
    if (!any) return { error: 'Business not found', status: 404 }
    return { error: 'Access denied', status: 403 }
  }
  return { business }
}

export async function GET(request, { params }) {
  try {
    const { businessId } = params
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const database = await connect()
    const auth = await verifyOwner(request, database, businessId)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const { business } = auth
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '30d'
    const tzParam = url.searchParams.get('tz')
    const tz = (tzParam && String(tzParam).trim()) || business.timezone || 'America/Toronto'
    if (!business.timezone && !tzParam) {
      console.warn('[insights] business timezone missing; using America/Toronto', { businessId })
    }

    const currency = (business.currency && String(business.currency).toUpperCase()) || 'CAD'
    const bid = business.businessId || businessId

    const [bookings, calls] = await Promise.all([
      loadMergedBookingsForInsights(database, bid),
      loadCallsForInsights(bid)
    ])

    const now = new Date()
    const nowMs = now.getTime()

    let minStart = Infinity
    let completedEver = 0
    let firstCompletedMs = Infinity
    for (const b of bookings) {
      const t = getBookingStartMs(b)
      if (t != null) minStart = Math.min(minStart, t)
      if (isCompletedBookingForInsights(b, nowMs)) {
        completedEver += 1
        if (t != null) firstCompletedMs = Math.min(firstCompletedMs, t)
      }
    }
    const noBookingsEver = minStart === Infinity
    const upcomingOnly = !noBookingsEver && completedEver === 0

    const { year, month } = currentMonthInTz(now, tz)
    let ly = year
    let lm = month - 1
    if (lm < 1) {
      lm = 12
      ly -= 1
    }

    const thisM = summarizeMonthBookings(bookings, nowMs, tz, year, month)
    const lastM = summarizeMonthBookings(bookings, nowMs, tz, ly, lm)

    const { startMs: monthStartMs, endExclusiveMs: monthEndEx } = monthRangeUtcInTz(year, month, tz)
    const callsHandledThisMonth = countCallsInRange(calls, monthStartMs, monthEndEx)
    const weeklyHours = normalizeWeeklyHoursForInsights(business)
    const callsAfterHours = countAfterHoursCalls(calls, tz, weeklyHours, monthStartMs, monthEndEx)

    const languagesUsed = Object.keys(thisM.langCount).sort()
    const languageBreakdown = thisM.langCount

    let trendDayCount = 30
    if (range === '90d') trendDayCount = 90
    else if (range === 'month') {
      trendDayCount = Math.min(
        90,
        Math.max(1, Math.ceil((nowMs - monthStartMs) / 86400000) + 1)
      )
    }

    const daysSinceFirstCompleted =
      firstCompletedMs === Infinity ? 0 : (nowMs - firstCompletedMs) / 86400000
    const trendEligible = !noBookingsEver && completedEver > 0 && daysSinceFirstCompleted >= 7
    const trend = trendEligible ? buildDailyTrend(bookings, nowMs, tz, trendDayCount) : []

    const topServices = topServicesThisMonth(bookings, nowMs, tz, year, month, 5)
    const hourHeatmap = buildHourHeatmap(calls, tz, weeklyHours, 14)

    const summary = {
      bookingsThisMonth: thisM.count,
      bookingsLastMonth: lastM.count,
      revenueThisMonth: Math.round(thisM.revenueCents) / 100,
      revenueLastMonth: Math.round(lastM.revenueCents) / 100,
      callsHandledThisMonth,
      callsAfterHours,
      languagesUsed,
      languageBreakdown
    }

    return NextResponse.json({
      ok: true,
      summary,
      trend,
      topServices,
      hourHeatmap,
      currency,
      businessTimezone: tz,
      meta: {
        noBookingsEver,
        upcomingOnly,
        trendEligible,
        heatmapEligible: hourHeatmap.length > 0
      }
    })
  } catch (err) {
    console.error('[insights]', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
