import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { checkRateLimit } from '@/lib/rateLimiting'
import { BookingTelemetry, RateLimitTelemetry, logError } from '@/lib/telemetry'
import { generateCancelToken } from '@/lib/security/resetToken'
import { generateRescheduleToken } from '@/lib/security/rescheduleToken'
import { bookingConfirmationEmail } from '@/lib/email/templates'
import { buildICS } from '@/lib/ics'
import { calculateReminders } from '@/lib/reminders'
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
  try {
    const database = await connect()
    const url = new URL(request.url)
    const handle = url.searchParams.get('handle')
    const body = await request.json()
    const { name, email, notes, start, end, guestTimezone } = body

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

    // Find owner
    const owner = await database.collection('users').findOne({ 
      'scheduling.handleLower': handle.toLowerCase() 
    })
    
    if (!owner || !owner.scheduling) {
      return NextResponse.json(
        { ok: false, error: 'Booking page not found' },
        { status: 404 }
      )
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

    // Check availability (FreeBusy)
    try {
      if (owner.google?.refreshToken) {
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

    // Create booking
    const bookingId = uuidv4()
    const cancelToken = generateCancelToken(bookingId, email)
    const rescheduleToken = isFeatureEnabled('RESCHEDULE') 
      ? generateRescheduleToken(bookingId, email) 
      : null
    
    // Calculate reminders if feature enabled
    const reminders = isFeatureEnabled('REMINDERS')
      ? calculateReminders(startTime.toISOString())
      : []

    const booking = {
      id: bookingId,
      userId: owner.id,
      title: `Meeting with ${name}`,
      customerName: name,
      guestEmail: email,
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

    // Insert Google Calendar event
    let googleEventId = null
    let googleCalendarId = null
    
    try {
      if (owner.google?.refreshToken) {
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

    // Send confirmation emails
    let emailDebug = { status: 'not_attempted', reason: 'unknown' }
    try {
      if (!env.RESEND_API_KEY) {
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
          from: 'Book8 AI <bookings@book8.ai>'
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
            from: 'Book8 AI <onboarding@resend.dev>',
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

    return NextResponse.json({
      ok: true,
      bookingId,
      cancelToken,
      rescheduleToken,
      emailDebug  // Include for debugging
    })

  } catch (error) {
    console.error('[book] Error:', error)
    logError(error, { endpoint: '/api/public/[handle]/book', handle: params.handle })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
