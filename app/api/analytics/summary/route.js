import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 60 // Cache for 60 seconds

let client, db

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
    
    const userId = auth.user.id
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '7d'
    
    // Parse range (7d, 30d, etc.)
    const daysMatch = range.match(/(\d+)d/)
    const days = daysMatch ? parseInt(daysMatch[1]) : 7
    
    // Calculate date range
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)
    
    // Ensure indexes exist
    try {
      await database.collection('bookings').createIndex({ userId: 1, startTime: 1 })
      await database.collection('bookings').createIndex({ status: 1, startTime: 1 })
      await database.collection('bookings').createIndex({ userId: 1, createdAt: 1 })
      await database.collection('cron_logs').createIndex({ task: 1, startedAt: -1 })
    } catch (e) {
      // Indexes might already exist, ignore errors
    }
    
    // Query all bookings in range
    const bookings = await database.collection('bookings').find({
      userId,
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    }).toArray()
    
    // Calculate KPIs
    const totalBookings = bookings.length
    const reschedules = bookings.filter(b => b.rescheduleCount > 0).length
    const cancellations = bookings.filter(b => b.status === 'canceled').length
    
    // Calculate avg lead time (time between booking creation and start time)
    let totalLeadTime = 0
    let leadTimeCount = 0
    
    bookings.forEach(booking => {
      if (booking.createdAt && booking.startTime) {
        const created = new Date(booking.createdAt)
        const start = new Date(booking.startTime)
        const diffMs = start - created
        if (diffMs > 0) {
          totalLeadTime += diffMs / (1000 * 60) // Convert to minutes
          leadTimeCount++
        }
      }
    })
    
    const avgLeadTimeMinutes = leadTimeCount > 0 
      ? Math.round(totalLeadTime / leadTimeCount) 
      : 0
    
    // Get reminders sent from cron logs
    const cronLogs = await database.collection('cron_logs').find({
      task: 'reminders',
      startedAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).toArray()
    
    const remindersSent = cronLogs.reduce((sum, log) => sum + (log.successes || 0), 0)
    
    // Build daily series
    const seriesMap = new Map()
    
    // Initialize all days with zeros
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
    
    // Populate series with actual data
    bookings.forEach(booking => {
      if (!booking.createdAt) return
      
      const date = new Date(booking.createdAt)
      const dateStr = date.toISOString().split('T')[0]
      
      if (seriesMap.has(dateStr)) {
        const day = seriesMap.get(dateStr)
        day.bookings++
        
        if (booking.status === 'canceled') {
          day.cancellations++
        }
        
        if (booking.rescheduleCount > 0) {
          day.reschedules++
        }
      }
    })
    
    // Add reminder sends to series
    cronLogs.forEach(log => {
      if (!log.startedAt) return
      
      const date = new Date(log.startedAt)
      const dateStr = date.toISOString().split('T')[0]
      
      if (seriesMap.has(dateStr)) {
        const day = seriesMap.get(dateStr)
        day.reminders_sent += (log.successes || 0)
      }
    })
    
    const series = Array.from(seriesMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    )
    
    const queryTime = Date.now() - startTime
    
    return NextResponse.json({
      ok: true,
      range,
      kpis: {
        bookings: totalBookings,
        reschedules,
        cancellations,
        reminders_sent: remindersSent,
        avg_lead_time_minutes: avgLeadTimeMinutes
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
