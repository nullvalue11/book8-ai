import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
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
    const businesses = await database.collection(BUSINESS_COLLECTION).find({ ownerUserId: userId }).sort({ createdAt: -1 }).limit(1).toArray()
    const businessId = businesses[0]?.businessId || null

    let bookings = []
    let calls = []
    const baseUrl = env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
    const apiKey = env.BOOK8_CORE_API_KEY || ''
    const internalSecret = env.CORE_API_INTERNAL_SECRET || ''

    if (businessId) {
      try {
        const [bookingsRes, callsRes] = await Promise.all([
          fetch(`${baseUrl}/api/bookings?businessId=${encodeURIComponent(businessId)}`, {
            headers: { 'Content-Type': 'application/json', ...(apiKey && { 'x-book8-api-key': apiKey }) },
            cache: 'no-store'
          }).then(r => r.json().catch(() => ({}))),
          fetch(`${baseUrl}/internal/calls/by-business/${businessId}?limit=500`, {
            headers: { 'Content-Type': 'application/json', ...(internalSecret && { 'x-book8-internal-secret': internalSecret }) },
            cache: 'no-store'
          }).then(r => r.json().catch(() => ({})))
        ])
        bookings = Array.isArray(bookingsRes?.bookings) ? bookingsRes.bookings : (Array.isArray(bookingsRes) ? bookingsRes : [])
        calls = Array.isArray(callsRes?.calls) ? callsRes.calls : (Array.isArray(callsRes) ? callsRes : [])
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
