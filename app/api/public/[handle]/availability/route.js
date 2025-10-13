import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { checkRateLimit } from '../../../../../lib/rateLimiting'
import { RateLimitTelemetry, logError } from '../../../../../lib/telemetry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

async function getGoogleFreeBusy(owner, startDate, endDate, selectedCalendarIds) {
  try {
    if (!owner.google?.refreshToken) return []
    
    const { google } = await import('googleapis')
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    oauth.setCredentials({ refresh_token: owner.google.refreshToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth })

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: selectedCalendarIds.map(id => ({ id }))
      }
    })

    const busySlots = []
    for (const calId of selectedCalendarIds) {
      const cal = response.data.calendars?.[calId]
      if (cal?.busy) {
        busySlots.push(...cal.busy)
      }
    }
    
    return busySlots
  } catch (error) {
    console.error('[availability] FreeBusy error:', error.message)
    return []
  }
}

function isSlotBusy(slotStart, slotEnd, busySlots) {
  for (const busy of busySlots) {
    const busyStart = new Date(busy.start)
    const busyEnd = new Date(busy.end)
    
    if (slotStart < busyEnd && slotEnd > busyStart) {
      return true
    }
  }
  return false
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export async function GET(request, { params }) {
  try {
    const database = await connect()
    const handle = params.handle
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const guestTz = searchParams.get('tz') || 'UTC'
    const duration = parseInt(searchParams.get('duration') || '0')

    if (!date) {
      return NextResponse.json(
        { ok: false, error: 'date parameter required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIp, 'publicBooking')
    
    if (!rateLimit.allowed) {
      RateLimitTelemetry.exceeded(clientIp, 'publicBooking', clientIp)
      return NextResponse.json(
        { ok: false, error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString()
          }
        }
      )
    }

    // Find user by handle
    const owner = await database.collection('users').findOne({ 
      'scheduling.handleLower': handle.toLowerCase() 
    })
    
    if (!owner || !owner.scheduling) {
      return NextResponse.json(
        { ok: false, error: 'Booking page not found' },
        { status: 404 }
      )
    }

    const settings = owner.scheduling
    const hostTz = settings.timeZone || 'UTC'
    const minNoticeMin = settings.minNoticeMin || 120
    const bufferMin = settings.bufferMin || 0
    const durationMin = duration || settings.defaultDurationMin || 30

    // Parse date in host timezone
    const requestDate = new Date(date + 'T00:00:00')
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][requestDate.getDay()]
    const workingHours = settings.workingHours || {}
    const daySlots = workingHours[dayOfWeek] || []

    if (daySlots.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        slots: [],
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        }
      })
    }

    // Generate time slots in host timezone
    const slots = []
    const now = new Date()
    const minStartTime = new Date(now.getTime() + minNoticeMin * 60000)

    for (const block of daySlots) {
      // Create datetime in host timezone
      let currentTime = new Date(`${date}T${block.start}:00`)
      const endTime = new Date(`${date}T${block.end}:00`)

      while (currentTime.getTime() + durationMin * 60000 <= endTime.getTime()) {
        if (currentTime >= minStartTime) {
          const slotEnd = new Date(currentTime.getTime() + durationMin * 60000)
          slots.push({
            start: currentTime.toISOString(),
            end: slotEnd.toISOString()
          })
        }
        currentTime = new Date(currentTime.getTime() + (durationMin + bufferMin) * 60000)
      }
    }

    // Check Google FreeBusy
    const selectedCalendarIds = settings.selectedCalendarIds || ['primary']
    const startOfDay = new Date(date + 'T00:00:00')
    const endOfDay = new Date(date + 'T23:59:59')
    const busySlots = await getGoogleFreeBusy(owner, startOfDay, endOfDay, selectedCalendarIds)

    // Filter out busy slots
    const availableSlots = slots.filter(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return !isSlotBusy(slotStart, slotEnd, busySlots)
    })

    return NextResponse.json({
      ok: true,
      slots: availableSlots,
      timezone: guestTz,
      settings: {
        duration: durationMin,
        buffer: bufferMin,
        minNotice: minNoticeMin
      }
    }, {
      headers: {
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': rateLimit.remaining.toString()
      }
    })

  } catch (error) {
    console.error('[availability] Error:', error)
    logError(error, { endpoint: '/api/public/[handle]/availability', handle: params.handle })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
