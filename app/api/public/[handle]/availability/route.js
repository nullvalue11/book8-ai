import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { checkRateLimit } from '../../../../lib/rateLimiting'
import { RateLimitTelemetry, logError } from '../../../../lib/telemetry'
import { env, debugLog } from '../../../../lib/env'

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

async function getGoogleFreeBusy(owner, startDate, endDate, selectedCalendarIds, debugContext = {}) {
  try {
    if (!owner.google?.refreshToken) {
      if (env.DEBUG_LOGS) {
        console.log('[availability] No refresh token', debugContext)
      }
      return { busy: [], error: null }
    }
    
    const { google } = await import('googleapis')
    const oauth = new google.auth.OAuth2(
      env.GOOGLE?.CLIENT_ID,
      env.GOOGLE?.CLIENT_SECRET,
      env.GOOGLE?.REDIRECT_URI
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
    
    if (env.DEBUG_LOGS) {
      console.log('[availability] FreeBusy success', { ...debugContext, busyCount: busySlots.length })
    }
    
    return { busy: busySlots, error: null }
  } catch (error) {
    console.error('[availability] FreeBusy error:', error.message, debugContext)
    
    // Check for invalid_grant
    if (error?.message?.includes('invalid_grant') || error?.code === 401) {
      return { 
        busy: [], 
        error: {
          code: 'GOOGLE_INVALID_GRANT',
          message: 'Google Calendar connection expired',
          hint: 'Please reconnect your Google Calendar in settings'
        }
      }
    }
    
    return { busy: [], error: { code: 'GOOGLE_API_ERROR', message: error.message } }
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
  console.log('=== AVAILABILITY DEBUG START ===')
  console.log('availability.debug', {
    handle: params.handle,
    url: request.url,
    time: new Date().toISOString(),
    method: request.method,
    headers: {
      'user-agent': request.headers.get('user-agent'),
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'referer': request.headers.get('referer')
    }
  })
  
  try {
    const database = await connect()
    console.log('availability.database', { connected: !!database })
    
    const handle = params.handle
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const guestTz = searchParams.get('tz') || 'UTC'
    const duration = parseInt(searchParams.get('duration') || '0')
    
    console.log('availability.params', { handle, date, guestTz, duration })

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
    
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: 'Booking page not found' },
        { status: 404 }
      )
    }

    if (!owner.scheduling || !owner.scheduling.handle) {
      return NextResponse.json(
        { ok: false, error: 'This booking page is not configured yet. Please contact the owner.' },
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
      
      // Handle end time - if 23:59, treat as end of day (one minute before midnight)
      // Need to add 59 seconds to make it truly 23:59:59
      let endTime
      if (block.end === '23:59') {
        // For 23:59, we want to allow slots up until the last possible slot before midnight
        endTime = new Date(`${date}T23:59:59`)
      } else {
        endTime = new Date(`${date}T${block.end}:00`)
      }

      // Generate slots for this time block
      while (currentTime.getTime() + durationMin * 60000 <= endTime.getTime()) {
        // Only add slots that meet minimum notice requirement
        if (currentTime >= minStartTime) {
          const slotEnd = new Date(currentTime.getTime() + durationMin * 60000)
          
          // Make sure the slot end doesn't go past the block end
          if (slotEnd <= endTime) {
            slots.push({
              start: currentTime.toISOString(),
              end: slotEnd.toISOString()
            })
          }
        }
        currentTime = new Date(currentTime.getTime() + (durationMin + bufferMin) * 60000)
      }
    }

    // Check Google FreeBusy
    const selectedCalendarIds = settings.selectedCalendarIds || ['primary']
    const startOfDay = new Date(date + 'T00:00:00')
    const endOfDay = new Date(date + 'T23:59:59')
    
    const debugContext = {
      handle,
      userId: owner.id,
      tz: guestTz,
      date,
      hasRefreshToken: !!owner.google?.refreshToken,
      selectedCalendarCount: selectedCalendarIds.length,
      needsReconnect: owner.google?.needsReconnect || false
    }
    
    if (env.DEBUG_LOGS) {
      console.log('[availability] Request context:', debugContext)
    }
    
    const freeBusyResult = await getGoogleFreeBusy(owner, startOfDay, endOfDay, selectedCalendarIds, debugContext)
    
    // If there's a Google error, return it to the client
    if (freeBusyResult.error) {
      return NextResponse.json({
        ok: false,
        ...freeBusyResult.error
      }, { status: 401 })
    }

    // Filter out busy slots
    const availableSlots = slots.filter(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return !isSlotBusy(slotStart, slotEnd, freeBusyResult.busy)
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
    console.error('=== AVAILABILITY ERROR ===')
    console.error('ERROR:', error.message)
    console.error('STACK:', error.stack)
    console.error('PARAMS:', params)
    console.error('=========================')
    logError(error, { endpoint: '/api/public/[handle]/availability', handle: params?.handle })
    return NextResponse.json(
      { ok: false, error: 'Internal server error', debug: error.message },
      { status: 500 }
    )
  }
}
