import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from '@/lib/rateLimiting'
import { BookingTelemetry, RateLimitTelemetry, logError } from '@/lib/telemetry'
import { generateCancelToken } from '@/lib/security/resetToken'
import { generateRescheduleToken } from '@/lib/security/rescheduleToken'
import { bookingConfirmationEmail } from '@/lib/email/templates'
import { buildICS } from '@/lib/ics'
import { calculateReminders, normalizeReminderSettings } from '@/lib/reminders'
import { env, isFeatureEnabled } from '@/lib/env'

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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export async function POST(request) {
  /* eslint-disable no-restricted-syntax -- debug: check process.env at runtime (Vercel may not pass to env module) */
  console.log('[public-book] ENV CHECK:', {
    CORE_API_INTERNAL_SECRET: !!(process.env.CORE_API_INTERNAL_SECRET),
    OPS_INTERNAL_SECRET: !!(process.env.OPS_INTERNAL_SECRET),
    BOOK8_CORE_API_KEY: !!(process.env.BOOK8_CORE_API_KEY),
    CORE_API_BASE_URL: process.env.CORE_API_BASE_URL || process.env.BOOK8_CORE_API_URL || 'not set'
  })
  /* eslint-enable no-restricted-syntax */

  try {
    const database = await connect()
    const url = new URL(request.url)
    const handle = url.searchParams.get('handle')
    const eventSlug = url.searchParams.get('eventSlug')
    const body = await request.json()
    const { name, email, phone, notes, start, end, guestTimezone, serviceId } = body

    if (!handle) {
      return NextResponse.json(
        { ok: false, error: 'Missing handle parameter' },
        { status: 400 }
      )
    }

    if (!name || !email || !start || !end) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: name, email, start, end' },
        { status: 400 }
      )
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 'unknown'
    const rateLimit = checkRateLimit(email, 'publicBooking')
    
    if (!rateLimit.allowed) {
      RateLimitTelemetry.exceeded(email, 'publicBooking', clientIp)
      return NextResponse.json(
        { ok: false, error: 'Too many booking requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Resolve by business first (handle, businessId), then fall back to user
    let owner = null
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [
        { handle: handle.toLowerCase() },
        { businessId: handle },
        { id: handle }
      ]
    })
    if (business) {
      owner = await database.collection('users').findOne({ id: business.ownerUserId })
      if (!owner) {
        return NextResponse.json(
          { ok: false, error: 'Booking page not found' },
          { status: 404 }
        )
      }
      if (!owner.scheduling) owner.scheduling = {}
    }
    if (!owner) {
      owner = await database.collection('users').findOne({
        'scheduling.handleLower': handle.toLowerCase()
      })
    }
    if (!owner || !owner.scheduling) {
      return NextResponse.json(
        { ok: false, error: 'Booking page not found' },
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
          { ok: false, error: 'Event type not found or inactive' },
          { status: 404 }
        )
      }
    }

    // Validate times
    const startTime = new Date(start)
    const endTime = new Date(end)
    
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }
    
    if (endTime <= startTime) {
      return NextResponse.json(
        { ok: false, error: 'End time must be after start time' },
        { status: 400 }
      )
    }

    // When we have a business: call core-api for SMS + email + calendar (bypass local creation for those)
    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
    const coreSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

    const willUseCoreApi = !!(business && coreSecret)
    console.log('[public-book] Decision:', {
      hasBusiness: !!business,
      businessId: business?.businessId,
      hasInternalSecret: !!coreSecret,
      secretVarName: env.CORE_API_INTERNAL_SECRET ? 'CORE_API_INTERNAL_SECRET' : env.OPS_INTERNAL_SECRET ? 'OPS_INTERNAL_SECRET' : 'none',
      condition: 'business && coreSecret',
      willUseCoreApi
    })

    if (business && coreSecret) {
      try {
        const slotStartISO = startTime.toISOString()
        const slotEndISO = endTime.toISOString()
        const slot = { start: slotStartISO, end: slotEndISO }
        const customer = {
          name,
          email,
          phone: phone || ''
        }

        const toolPayload = {
          businessId: business.businessId,
          tool: 'booking.create',
          input: {
            businessId: business.businessId,
            serviceId: serviceId || 'manual-booking',
            slot,
            customer,
            notes: notes || ''
          }
        }

        console.log('[public-book] Sending to core-api:', JSON.stringify({ businessId: business.businessId, serviceId: serviceId || 'manual-booking', slot, customer }))

        const coreRes = await fetch(`${baseUrl}/internal/execute-tool`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-book8-internal-secret': coreSecret
          },
          body: JSON.stringify(toolPayload),
          cache: 'no-store'
        })

        const coreData = await coreRes.json().catch(() => ({}))
        console.log('[public-book] Core-api response:', JSON.stringify(coreData))

        if (!coreRes.ok) {
          console.error('[public/book] core-api booking failed:', coreRes.status, coreData)
          return NextResponse.json(
            { ok: false, error: coreData?.error || coreData?.message || 'Booking failed. Please try again.' },
            { status: coreRes.status >= 400 ? coreRes.status : 502 }
          )
        }

        // core-api succeeded (SMS + email + calendar done). We still create local record for reschedule/cancel tokens.
        // Fall through to create local booking with our tokens
      } catch (coreErr) {
        console.error('[public/book] core-api call error:', coreErr?.message || coreErr)
        return NextResponse.json(
          { ok: false, error: 'Booking service unavailable. Please try again later.' },
          { status: 503 }
        )
      }
    }

    // Check availability (FreeBusy) — only when NOT using core-api (user-only flow)
    if (!business) {
    try {
      if (owner?.google?.refreshToken) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE?.CLIENT_ID,
          env.GOOGLE?.CLIENT_SECRET,
          env.GOOGLE?.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        const selectedCalendarIds = owner.scheduling.selectedCalendarIds || ['primary']
        const response = await calendar.freebusy.query({
          requestBody: {
            timeMin: startTime.toISOString(),
            timeMax: endTime.toISOString(),
            items: selectedCalendarIds.map(id => ({ id }))
          }
        })

        // Check for conflicts
        for (const calId of selectedCalendarIds) {
          const cal = response.data.calendars?.[calId]
          if (cal?.busy && cal.busy.length > 0) {
            for (const busy of cal.busy) {
              const busyStart = new Date(busy.start)
              const busyEnd = new Date(busy.end)
              
              if (startTime < busyEnd && endTime > busyStart) {
                return NextResponse.json(
                  { ok: false, error: 'This time slot is no longer available' },
                  { status: 409 }
                )
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[book] FreeBusy check error:', error.message)
    }
    }

    // Create booking (local record for reschedule/cancel tokens)
    const bookingId = uuidv4()
    const cancelToken = generateCancelToken(bookingId, email)
    const rescheduleToken = isFeatureEnabled('RESCHEDULE') 
      ? generateRescheduleToken(bookingId, email) 
      : null
    
    // Get reminder preferences: event type override > owner default
    const eventReminderSettings = eventType?.scheduling?.reminders
    const ownerReminderSettings = owner.scheduling?.reminders
    const reminderPrefs = normalizeReminderSettings(eventReminderSettings || ownerReminderSettings)
    
    // Calculate reminders if feature enabled, respecting preferences
    const reminders = isFeatureEnabled('REMINDERS')
      ? calculateReminders(startTime.toISOString(), reminderPrefs)
      : []
    
    // Build booking title
    const bookingTitle = eventType 
      ? `${eventType.name} with ${name}`
      : `Meeting with ${name}`
    
    console.log(`[book] Creating booking with ${reminders.length} reminders (enabled: ${reminderPrefs.enabled}, guest: ${reminderPrefs.guestEnabled}, host: ${reminderPrefs.hostEnabled}, eventType: ${eventType?.slug || 'default'})`)

    const booking = {
      id: bookingId,
      userId: owner.id,
      businessId: business?.businessId || null,
      eventTypeId: eventType?.id || null,
      eventTypeSlug: eventType?.slug || null,
      title: bookingTitle,
      customerName: name,
      guestEmail: email,
      guestPhone: phone || null,
      guestTimezone: guestTimezone || owner.scheduling.timeZone || 'UTC',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      timeZone: owner.scheduling.timeZone || 'UTC',
      notes: notes || '',
      status: 'confirmed',
      rescheduleCount: 0,
      rescheduleHistory: [],
      rescheduleNonces: [],
      cancelToken,
      rescheduleToken,
      reminders,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    await database.collection('bookings').insertOne(booking)

    // Insert Google Calendar event — skip when core-api already did it (business flow)
    let googleEventId = null
    let googleCalendarId = null
    
    const skipLocalCalendarAndEmail = !!business && !!coreSecret

    try {
      if (!skipLocalCalendarAndEmail && owner.google?.refreshToken) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE?.CLIENT_ID,
          env.GOOGLE?.CLIENT_SECRET,
          env.GOOGLE?.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        const baseUrl = env.BASE_URL || 'http://localhost:3000'
        const event = {
          summary: booking.title,
          description: `${notes || ''}\n\n---\nSource: Book8 AI Public Booking\nGuest: ${email}\nBooking ID: ${bookingId}\n\nManage:\nReschedule: ${baseUrl}/b/${handle}/reschedule?token=${rescheduleToken}\nCancel: ${baseUrl}/api/public/bookings/cancel?token=${cancelToken}`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: owner.scheduling.timeZone || 'UTC'
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: owner.scheduling.timeZone || 'UTC'
          },
          attendees: [{ email }]
        }

        const selectedCalendarIds = owner.scheduling.selectedCalendarIds || ['primary']
        for (const calendarId of selectedCalendarIds) {
          try {
            const ins = await calendar.events.insert({ calendarId, requestBody: event })
            googleEventId = ins.data.id
            googleCalendarId = calendarId
            
            await database.collection('bookings').updateOne(
              { id: bookingId },
              { $set: { googleEventId, googleCalendarId } }
            )
            
            console.log('[book] Google event created:', googleEventId)
            BookingTelemetry.created(bookingId, 'public', owner.email)
            break
          } catch (e) {
            console.error('[book] Failed to insert event:', e.message)
          }
        }
      }
    } catch (error) {
      console.error('[book] Google Calendar error:', error.message)
    }

    // Send confirmation emails — skip when core-api already sent (business flow)
    let emailDebug = { status: 'not_attempted', reason: 'unknown' }
    try {
      if (skipLocalCalendarAndEmail) {
        emailDebug = { status: 'skipped', reason: 'core-api handles email for business bookings' }
      } else if (!env.RESEND_API_KEY) {
        emailDebug = { status: 'skipped', reason: 'RESEND_API_KEY not configured' }
        console.log('[booking/email] Skipping email - no API key configured')
      } else {
        const { Resend } = await import('resend')
        const resend = new Resend(env.RESEND_API_KEY)
        const baseUrl = env.BASE_URL

        console.log('[booking/email] Preparing to send confirmation', {
          toGuest: email,
          toHost: owner.email,
          bookingId,
          hasApiKey: !!env.RESEND_API_KEY,
          from: 'Book8 AI <bookings@book8.io>'
        })

        const emailHtml = bookingConfirmationEmail(
          booking,
          owner,
          baseUrl,
          rescheduleToken,
          cancelToken,
          guestTimezone
        )

        // Generate ICS
        const icsContent = buildICS({
          uid: `booking-${bookingId}@book8.ai`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          summary: booking.title,
          description: `${notes || ''}\n\n---\nSource: Book8 AI Public Booking\nBooking ID: ${bookingId}`,
          organizer: 'noreply@book8.ai',
          attendees: [{ email, name }],
          method: 'REQUEST'
        })

        const guestTzLabel = guestTimezone || booking.timeZone
        const dateStr = new Date(startTime).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: guestTzLabel
        })

        let emailResult
        try {
          emailResult = await resend.emails.send({
            from: 'Book8 AI <bookings@book8.io>',
            to: email,
            cc: owner.email,
            subject: `Your Book8 meeting is confirmed – ${dateStr} (${guestTzLabel})`,
            html: emailHtml,
            attachments: [
              {
                filename: 'booking.ics',
                content: Buffer.from(icsContent).toString('base64')
              }
            ]
          })

          console.log('[booking/email] Resend response SUCCESS', {
            id: emailResult?.id,
            data: emailResult
          })
          
          emailDebug = { 
            status: 'sent', 
            id: emailResult?.id || null,
            to: email,
            cc: owner.email
          }

        } catch (err) {
          console.error('[booking/email] Resend error FAILED', {
            message: err?.message,
            name: err?.name,
            code: err?.code,
            statusCode: err?.statusCode,
            stack: err?.stack
          })
          
          emailDebug = {
            status: 'failed',
            error: err?.message || 'Unknown error',
            code: err?.code || null,
            statusCode: err?.statusCode || null
          }
        }
      }
    } catch (error) {
      console.error('[book] Email outer catch error:', error.message, error)
      emailDebug = {
        status: 'failed',
        error: error.message,
        type: 'outer_catch'
      }
    }

    const response = {
      ok: true,
      bookingId,
      cancelToken,
      rescheduleToken
    }

    // Only include emailDebug in non-production or when debug logs enabled
    if (env.DEBUG_LOGS) {
      response.emailDebug = emailDebug
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[book] Error:', error)
    logError(error, { endpoint: '/api/public/book', handle })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
