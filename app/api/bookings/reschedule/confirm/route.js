import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyRescheduleToken, generateRescheduleToken } from '../../../../lib/security/rescheduleToken'
import { generateCancelToken } from '../../../../lib/security/resetToken'
import { checkRateLimit } from '../../../../lib/rateLimiting'
import { BookingTelemetry, RateLimitTelemetry, logError } from '../../../../lib/telemetry'
import { rescheduleConfirmationEmail } from '../../../../lib/email/templates'
import { buildICS } from '../../../../lib/ics'
import { recomputeReminders } from '../../../../lib/reminders'
import { renderHostReschedule } from '../../../../lib/emailRenderer'
import { env, isFeatureEnabled } from '../../../../lib/env'

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
    if (!isFeatureEnabled('FEATURE_RESCHEDULE')) {
      return NextResponse.json(
        { ok: false, error: 'Reschedule feature is not enabled' },
        { status: 503 }
      )
    }

    const database = await connect()
    const body = await request.json()
    const { token, newStart, newEnd } = body

    if (!token || !newStart || !newEnd) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: token, newStart, newEnd' },
        { status: 400 }
      )
    }

    // Verify token
    const decoded = verifyRescheduleToken(token)
    if (!decoded) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 410 }
      )
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = checkRateLimit(decoded.bookingId, 'reschedule')
    const ipRateLimit = checkRateLimit(clientIp, 'reschedule')
    
    if (!rateLimit.allowed || !ipRateLimit.allowed) {
      RateLimitTelemetry.exceeded(decoded.bookingId, 'reschedule', clientIp)
      return NextResponse.json(
        { ok: false, error: 'Too many reschedule requests. Please try again later.' },
        { status: 429 }
      )
    }

    // Find booking
    const booking = await database.collection('bookings').findOne({ 
      id: decoded.bookingId 
    })
    
    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Verify email matches
    if (booking.guestEmail !== decoded.guestEmail) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if canceled
    if (booking.status === 'canceled') {
      return NextResponse.json(
        { ok: false, error: 'This booking has been canceled and cannot be rescheduled' },
        { status: 410 }
      )
    }

    // Check if nonce already used
    const nonceEntry = booking.rescheduleNonces?.find(n => n.nonce === decoded.nonce)
    if (nonceEntry && nonceEntry.usedAt) {
      return NextResponse.json(
        { ok: false, error: 'This reschedule link has already been used' },
        { status: 410 }
      )
    }

    // Check reschedule limit
    const rescheduleCount = booking.rescheduleCount || 0
    if (rescheduleCount >= 3) {
      return NextResponse.json(
        { ok: false, error: 'Maximum reschedule limit (3) reached for this booking' },
        { status: 400 }
      )
    }

    // Validate new times
    const newStartTime = new Date(newStart)
    const newEndTime = new Date(newEnd)
    
    if (isNaN(newStartTime.getTime()) || isNaN(newEndTime.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid date format' },
        { status: 400 }
      )
    }
    
    if (newEndTime <= newStartTime) {
      return NextResponse.json(
        { ok: false, error: 'End time must be after start time' },
        { status: 400 }
      )
    }

    // Get owner
    const owner = await database.collection('users').findOne({ id: booking.userId })
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: 'Owner not found' },
        { status: 404 }
      )
    }

    // Check FreeBusy for new slot
    try {
      if (owner.google?.refreshToken) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE.CLIENT_ID,
          env.GOOGLE.CLIENT_SECRET,
          env.GOOGLE.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        const selectedCalendarIds = owner.scheduling?.selectedCalendarIds || ['primary']
        const response = await calendar.freebusy.query({
          requestBody: {
            timeMin: newStartTime.toISOString(),
            timeMax: newEndTime.toISOString(),
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
              
              // Skip if it's the current booking's event
              if (booking.googleEventId && busy.id === booking.googleEventId) {
                continue
              }
              
              if (newStartTime < busyEnd && newEndTime > busyStart) {
                return NextResponse.json(
                  { ok: false, error: 'The selected time slot is not available' },
                  { status: 409 }
                )
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[reschedule/confirm] FreeBusy check error:', error.message)
    }

    // Delete old Google Calendar event
    try {
      if (owner.google?.refreshToken && booking.googleEventId) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE.CLIENT_ID,
          env.GOOGLE.CLIENT_SECRET,
          env.GOOGLE.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        try {
          await calendar.events.delete({
            calendarId: booking.googleCalendarId || 'primary',
            eventId: booking.googleEventId
          })
          console.log('[reschedule/confirm] Deleted old event:', booking.googleEventId)
        } catch (e) {
          console.error('[reschedule/confirm] Failed to delete old event:', e.message)
        }
      }
    } catch (error) {
      console.error('[reschedule/confirm] Google delete error:', error.message)
    }

    // Create new Google Calendar event
    let newGoogleEventId = null
    try {
      if (owner.google?.refreshToken) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE.CLIENT_ID,
          env.GOOGLE.CLIENT_SECRET,
          env.GOOGLE.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        const baseUrl = env.BASE_URL || 'http://localhost:3000'
        const newRescheduleToken = generateRescheduleToken(booking.id, booking.guestEmail)
        const newCancelToken = generateCancelToken(booking.id, booking.guestEmail)

        const event = {
          summary: booking.title,
          description: `${booking.notes || ''}\n\n---\nSource: Book8 AI Public Booking (Rescheduled)\nGuest: ${booking.guestEmail}\nBooking ID: ${booking.id}\n\nManage:\nReschedule: ${baseUrl}/b/${owner.scheduling?.handle}/reschedule?token=${newRescheduleToken}\nCancel: ${baseUrl}/api/public/bookings/cancel?token=${newCancelToken}`,
          start: {
            dateTime: newStartTime.toISOString(),
            timeZone: booking.timeZone || 'UTC'
          },
          end: {
            dateTime: newEndTime.toISOString(),
            timeZone: booking.timeZone || 'UTC'
          },
          attendees: [{ email: booking.guestEmail }]
        }

        const calendarId = booking.googleCalendarId || 'primary'
        const ins = await calendar.events.insert({ calendarId, requestBody: event })
        newGoogleEventId = ins.data.id
        console.log('[reschedule/confirm] Created new event:', newGoogleEventId)
      }
    } catch (error) {
      console.error('[reschedule/confirm] Google insert error:', error.message)
    }

    // Update booking
    const updatedBooking = {
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
      status: 'rescheduled',
      rescheduleCount: rescheduleCount + 1,
      googleEventId: newGoogleEventId || booking.googleEventId,
      updatedAt: new Date().toISOString()
    }

    // Add to reschedule history
    const historyEntry = {
      from: { start: booking.startTime, end: booking.endTime },
      to: { start: newStartTime.toISOString(), end: newEndTime.toISOString() },
      at: new Date().toISOString(),
      by: 'guest'
    }

    // Mark nonce as used
    const updatedNonces = booking.rescheduleNonces || []
    const nonceIndex = updatedNonces.findIndex(n => n.nonce === decoded.nonce)
    if (nonceIndex >= 0) {
      updatedNonces[nonceIndex].usedAt = new Date().toISOString()
    }

    await database.collection('bookings').updateOne(
      { id: booking.id },
      { 
        $set: updatedBooking,
        $push: { rescheduleHistory: historyEntry },
        $set: { rescheduleNonces: updatedNonces }
      }
    )

    const finalBooking = { ...booking, ...updatedBooking }

    // Send confirmation emails
    try {
      if (env.RESEND_API_KEY && env.RESEND_API_KEY !== 'your_resend_api_key_here') {
        const { Resend } = await import('resend')
        const resend = new Resend(env.RESEND_API_KEY)
        const baseUrl = env.BASE_URL || 'http://localhost:3000'

        const newRescheduleToken = generateRescheduleToken(booking.id, booking.guestEmail)
        const newCancelToken = generateCancelToken(booking.id, booking.guestEmail)

        const emailHtml = rescheduleConfirmationEmail(
          finalBooking,
          owner,
          finalBooking.rescheduleCount,
          baseUrl,
          newRescheduleToken,
          newCancelToken,
          booking.guestTimezone
        )

        const icsContent = buildICS({
          uid: `booking-${booking.id}@book8.ai`,
          start: newStartTime.toISOString(),
          end: newEndTime.toISOString(),
          summary: booking.title,
          description: `${booking.notes || ''}\n\n---\nSource: Book8 AI Public Booking\nBooking ID: ${booking.id}`,
          organizer: 'noreply@book8.ai',
          attendees: [{ email: booking.guestEmail, name: booking.customerName }],
          method: 'REQUEST'
        })

        const guestTzLabel = booking.guestTimezone || booking.timeZone
        const dateStr = new Date(newStartTime).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: 'numeric', 
          minute: '2-digit',
          timeZone: guestTzLabel
        })

        await resend.emails.send({
          from: 'Book8 AI <bookings@book8.ai>',
          to: booking.guestEmail,
          cc: owner.email,
          subject: `Your Book8 meeting was rescheduled – ${dateStr} (${guestTzLabel})`,
          html: emailHtml,
          attachments: [
            {
              filename: 'booking.ics',
              content: Buffer.from(icsContent).toString('base64')
            }
          ]
        })

        console.log('[reschedule/confirm] Confirmation email sent')
      }
    } catch (error) {
      console.error('[reschedule/confirm] Email error:', error.message)
    }

    // Log telemetry
    BookingTelemetry.rescheduled(booking.id, booking.guestEmail, finalBooking.rescheduleCount)

    return NextResponse.json({
      ok: true,
      booking: finalBooking,
      remainingReschedules: 3 - finalBooking.rescheduleCount
    })

  } catch (error) {
    console.error('[reschedule/confirm] Error:', error)
    logError(error, { endpoint: '/api/bookings/reschedule/confirm' })
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
