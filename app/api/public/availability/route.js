import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { checkRateLimit } from '@/lib/rateLimiting'
import { RateLimitTelemetry, logError } from '@/lib/telemetry'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { zonedTimeToUtc, formatInTimeZone } from 'date-fns-tz'
import { enUS } from 'date-fns/locale'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'

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
      console.log('[availability] FreeBusy OK', { ...debugContext, busyCount: busySlots.length })
    }

    return { busy: busySlots, error: null }

  } catch (error) {
    console.error('[availability] FreeBusy error:', error.message || error)
    
    if (error.message?.includes('invalid_grant')) {
      return {
        busy: [],
        error: {
          code: 'GOOGLE_INVALID_GRANT',
          message: 'Google Calendar needs to be reconnected',
          hint: 'Please ask the owner to reconnect their Google Calendar in Settings.'
        }
      }
    }

    return {
      busy: [],
      error: {
        code: 'GOOGLE_ERROR',
        message: 'Failed to check Google Calendar availability',
        hint: error.message
      }
    }
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

function timeToMinutes(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Keep slots fully inside one of the provider's blocks for this calendar date (hostTz). */
function filterSlotsByProviderWorkingHours(slots, dateYmd, hostTz, weeklyHours, _durationMin) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return slots
  const noonUtc = zonedTimeToUtc(`${dateYmd}T12:00:00`, hostTz)
  const abbrev = formatInTimeZone(noonUtc, hostTz, 'EEE', { locale: enUS }).toLowerCase().replace(/\./g, '')
  const short = abbrev.slice(0, 3)
  const mapShortToFull = {
    sun: 'sunday',
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday'
  }
  const fullDay = mapShortToFull[short]
  if (!fullDay) return slots
  const daySegs = weeklyHours[fullDay]
  if (!Array.isArray(daySegs) || daySegs.length === 0) return []

  return slots.filter((slot) => {
    const slotStart = new Date(slot.start)
    const slotEnd = new Date(slot.end)
    const startLabel = formatInTimeZone(slotStart, hostTz, 'HH:mm')
    const endLabel = formatInTimeZone(slotEnd, hostTz, 'HH:mm')
    const sm = timeToMinutes(startLabel)
    const em = timeToMinutes(endLabel)
    for (const block of daySegs) {
      if (!block?.start || !block?.end) continue
      const bm = timeToMinutes(block.start)
      let bme = timeToMinutes(block.end)
      if (String(block.end) === '23:59') bme = 24 * 60
      if (sm >= bm && em <= bme) return true
    }
    return false
  })
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = url.searchParams.get('handle')
    const date = url.searchParams.get('date')
    const guestTz = url.searchParams.get('tz') || 'UTC'
    const duration = parseInt(url.searchParams.get('duration') || '0')
    const eventSlug = url.searchParams.get('eventSlug')
    const providerId = url.searchParams.get('providerId')

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'handle parameter required' },
        { status: 400 }
      )
    }

    if (!date) {
      return NextResponse.json(
        { ok: false, error: 'date parameter required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(clientIp, 'publicBooking')
    
    if (!rateLimit.allowed) {
      RateLimitTelemetry.exceeded(clientIp, 'publicBooking', clientIp)
      return NextResponse.json(
        { ok: false, code: 'RATE_LIMIT', error: 'Too many requests. Please try again later.' },
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

    // Resolve by business first (handle, businessId, or id), then fall back to user
    let owner = null
    let business = null
    let ownerName = ''

    business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [
        { handle: handle.toLowerCase() },
        { businessId: handle },
        { id: handle }
      ]
    })

    if (business) {
      ownerName = business.name || handle
      const ownerUser = await database.collection('users').findOne({ id: business.ownerUserId })
      if (!ownerUser) {
        return NextResponse.json(
          { ok: false, code: 'USER_NOT_FOUND', error: 'Booking page not found' },
          { status: 404 }
        )
      }
      owner = ownerUser
      // For businesses: use owner's scheduling, or fetch schedule from core-api
      if (!owner.scheduling) {
        owner.scheduling = {}
      }
    }

    if (!owner) {
      owner = await database.collection('users').findOne({
        'scheduling.handleLower': handle.toLowerCase()
      })
      if (owner?.scheduling?.handle) ownerName = owner.name || owner.scheduling.handle || handle
    }

    if (!owner) {
      return NextResponse.json(
        { ok: false, code: 'USER_NOT_FOUND', error: 'Booking page not found' },
        { status: 404 }
      )
    }

    if (!business && (!owner.scheduling || !owner.scheduling.handle)) {
      return NextResponse.json(
        { ok: false, code: 'SCHEDULING_NOT_CONFIGURED', error: '⚙️ This booking page is not configured yet. Please contact the owner.' },
        { status: 404 }
      )
    }

    // Load event type if specified
    let eventType = null
    if (eventSlug) {
      eventType = await database.collection('event_types').findOne({
        userId: owner.id,
        slug: eventSlug.toLowerCase(),
        isActive: true
      })
      
      if (!eventType) {
        return NextResponse.json(
          { ok: false, code: 'EVENT_TYPE_NOT_FOUND', error: 'Event type not found or inactive' },
          { status: 404 }
        )
      }
    }

    // Merge settings: event type overrides > user defaults
    let settings = owner.scheduling || {}
    const eventSettings = eventType?.scheduling || {}

    // For businesses: weekly hours from core-api, else Mongo localSchedule (BOO-49 pending sync)
    if (business && env.CORE_API_BASE_URL) {
      const dayMap = {
        sunday: 'sun', sun: 'sun', 0: 'sun',
        monday: 'mon', mon: 'mon', 1: 'mon',
        tuesday: 'tue', tue: 'tue', 2: 'tue',
        wednesday: 'wed', wed: 'wed', 3: 'wed',
        thursday: 'thu', thu: 'thu', 4: 'thu',
        friday: 'fri', fri: 'fri', 5: 'fri',
        saturday: 'sat', sat: 'sat', 6: 'sat'
      }
      const rawToWorkingHours = (raw) => {
        if (!raw || typeof raw !== 'object' || !Object.keys(raw).length) return null
        const workingHours = {}
        for (const [k, v] of Object.entries(raw)) {
          const canon = dayMap[String(k).toLowerCase()] || k.toLowerCase().slice(0, 3)
          if (Array.isArray(v) && v.length) {
            workingHours[canon] = v
          } else if (v && typeof v === 'object' && (v.enabled === true || v.enabled === undefined) && v.start && v.end) {
            workingHours[canon] = [{ start: v.start, end: v.end }]
          }
        }
        return Object.keys(workingHours).length ? workingHours : null
      }

      let mergedHours = false
      try {
        const baseUrl = (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
        const apiKey = env.BOOK8_CORE_API_KEY || ''
        const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
        const scheduleRes = await fetch(
          `${baseUrl}/api/businesses/${business.businessId}/schedule`,
          {
            headers: {
              ...(apiKey && { 'x-book8-api-key': apiKey }),
              ...(internalSecret && { 'x-book8-internal-secret': internalSecret })
            },
            cache: 'no-store'
          }
        )
        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json()
          const raw =
            scheduleData?.weeklySchedule?.weeklyHours ||
            scheduleData?.weeklyHours ||
            scheduleData?.schedule?.weeklyHours ||
            scheduleData?.schedule ||
            scheduleData?.workingHours ||
            scheduleData
          const workingHours = rawToWorkingHours(raw)
          if (workingHours) {
            settings = {
              ...settings,
              workingHours,
              timeZone: scheduleData?.schedule?.timezone || scheduleData?.timezone || settings.timeZone || 'UTC'
            }
            mergedHours = true
          }
        }
      } catch (e) {
        if (env.DEBUG_LOGS) console.log('[availability] core-api schedule fetch failed:', e?.message)
      }

      if (!mergedHours && business.localSchedule?.weeklyHours) {
        const workingHours = rawToWorkingHours(business.localSchedule.weeklyHours)
        if (workingHours) {
          settings = {
            ...settings,
            workingHours,
            timeZone: business.localSchedule.timezone || settings.timeZone || 'UTC'
          }
        }
      }
    }

    // Calendars to use for availability (fallback to primary)
    const selectedCalendarIds =
      Array.isArray(settings.selectedCalendarIds) && settings.selectedCalendarIds.length
        ? settings.selectedCalendarIds
        : ['primary']
    
    const logContext = {
      handle,
      userId: owner.id,
      date,
      duration,
      eventSlug: eventSlug || null,
      eventTypeId: eventType?.id || null,
      tz: guestTz,
      hasRefreshToken: !!owner.google?.refreshToken,
      selectedCalendarCount: selectedCalendarIds.length,
      needsReconnect: owner.google?.needsReconnect || false,
      googleConnected: owner.google?.connected || false
    }

    if (env.DEBUG_LOGS) {
      console.log('[availability] Processing request:', logContext)
    }

    const hostTz = settings.timeZone || 'UTC'
    // Event type overrides
    const minNoticeMin = eventSettings.minNoticeMin ?? settings.minNoticeMin ?? 120
    const bufferMin = eventSettings.bufferMin ?? settings.bufferMin ?? 0
    // Duration priority: query param > event type > user default
    const durationMin = duration || eventType?.durationMinutes || settings.defaultDurationMin || 30
    // Working hours: event type override or user default
    const workingHours = eventSettings.workingHours || settings.workingHours || {}

    // Weekday for `date` must follow the business (host) timezone, not the server's local clock
    const noonUtc = zonedTimeToUtc(`${date}T12:00:00`, hostTz)
    const abbrev = formatInTimeZone(noonUtc, hostTz, 'EEE', { locale: enUS }).toLowerCase()
    const abbrevToKey = { sun: 'sun', mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat' }
    const dayOfWeek = abbrevToKey[abbrev] || abbrev.slice(0, 3)
    const daySlots = workingHours[dayOfWeek] || []

    if (daySlots.length === 0) {
      return NextResponse.json({
        ok: true,
        slots: [],
        businessName: ownerName || owner?.name || null,
        message: business ? 'Business is closed on this day' : undefined
      }, {
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        }
      })
    }

    // Generate time slots using business hours (openTime/closeTime) in host timezone
    const slots = []
    const now = new Date()
    const minStartTime = new Date(now.getTime() + minNoticeMin * 60000)

    for (const block of daySlots) {
      const openTime = block.start
      const closeTime = block.end === '23:59' ? '23:59' : block.end
      const pad2 = (n) => String(n).padStart(2, '0')
      const [openH, openM] = openTime.split(':').map(Number)
      const [closeH, closeM] = closeTime.split(':').map(Number)

      // Create start/end in host timezone, convert to UTC for correct slot times
      let currentTime = zonedTimeToUtc(`${date}T${pad2(openH)}:${pad2(openM)}:00`, hostTz)
      const endTime = zonedTimeToUtc(`${date}T${pad2(closeH)}:${pad2(closeM)}:00`, hostTz)

      while (currentTime.getTime() + durationMin * 60000 <= endTime.getTime()) {
        if (currentTime >= minStartTime) {
          const slotEnd = new Date(currentTime.getTime() + durationMin * 60000)
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

    // Check Google FreeBusy for the full calendar day in the host timezone
    const startOfDay = zonedTimeToUtc(`${date}T00:00:00`, hostTz)
    const endOfDay = zonedTimeToUtc(`${date}T23:59:59`, hostTz)
    
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
    
    // If there's a Google error, return it to the client with consistent format
    if (freeBusyResult.error) {
      return NextResponse.json({
        ok: false,
        code: freeBusyResult.error.code,
        message: freeBusyResult.error.message,
        hint: freeBusyResult.error.hint,
        error: freeBusyResult.error.message
      }, { 
        status: 401,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': rateLimit.remaining.toString()
        }
      })
    }

    // Filter out busy slots
    let availableSlots = slots.filter(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return !isSlotBusy(slotStart, slotEnd, freeBusyResult.busy)
    })

    if (business && providerId) {
      const provList = business.providers || []
      const prov = provList.find((p) => {
        if (!p || p.active === false) return false
        const idMatch = String(p.id) === String(providerId)
        const oid =
          p._id != null &&
          (typeof p._id?.toString === 'function'
            ? p._id.toString()
            : String(p._id)) === String(providerId)
        return idMatch || oid
      })
      if (!prov) {
        return NextResponse.json(
          {
            ok: true,
            slots: [],
            message: 'Provider not found',
            timezone: guestTz,
            ownerName: ownerName || owner.name || handle,
            businessName: business?.name || ownerName || owner.name || null,
            settings: {
              duration: durationMin,
              buffer: bufferMin,
              minNotice: minNoticeMin
            }
          },
          {
            headers: {
              'X-RateLimit-Limit': '10',
              'X-RateLimit-Remaining': rateLimit.remaining.toString()
            }
          }
        )
      }
      if (prov?.weeklyHours && typeof prov.weeklyHours === 'object') {
        availableSlots = filterSlotsByProviderWorkingHours(
          availableSlots,
          date,
          hostTz,
          prov.weeklyHours,
          durationMin
        )
      }
    }

    return NextResponse.json({
      ok: true,
      slots: availableSlots,
      timezone: guestTz,
      ownerName: ownerName || owner.name || handle,
      businessName: business?.name || ownerName || owner.name || null,
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
    logError(error, { endpoint: '/api/public/availability' })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0'
        }
      }
    )
  }
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
