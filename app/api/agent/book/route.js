/**
 * POST /api/agent/book
 * 
 * Purpose:
 * Let an AI phone agent create a booking on behalf of a caller.
 * Creates a booking with source: "phone-agent" for tracking.
 * 
 * Authentication:
 * Requires `agentApiKey` in request body. The key must match
 * a phoneAgents[].agentApiKey entry in a user's document.
 * 
 * Request Body:
 * {
 *   "agentApiKey": "ag_sk_123...",           // Required - agent secret key
 *   "handle": "waismofit",                    // Optional - defaults to owner's handle
 *   "start": "2025-12-01T14:30:00-05:00",    // Required - ISO datetime
 *   "durationMinutes": 30,                    // Optional - defaults to owner's default
 *   "guestName": "John Doe",                  // Required
 *   "guestEmail": "john@example.com",         // Required
 *   "guestPhone": "+1AAA...BBB",              // Optional
 *   "notes": "Wants a haircut fade",          // Optional
 *   "timezone": "America/Toronto",            // Optional - for display purposes
 *   "language": "fr"                          // Optional - en|fr|es|ar confirmation email; default en
 * }
 * 
 * Response (success):
 * {
 *   "ok": true,
 *   "bookingId": "abc123",
 *   "handle": "waismofit",
 *   "start": "2025-12-01T14:30:00-05:00",
 *   "end": "2025-12-01T15:00:00-05:00",
 *   "hostTimezone": "America/Toronto",
 *   "guest": {
 *     "name": "John Doe",
 *     "email": "john@example.com",
 *     "phone": "+1AAA...BBB"
 *   }
 * }
 * 
 * Response (slot taken):
 * {
 *   "ok": false,
 *   "code": "SLOT_TAKEN",
 *   "message": "That time slot is no longer available. Please pick another time."
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { 
  findAgentOwnerByKey, 
  AGENT_UNAUTHORIZED_ERROR,
  logAgentCall 
} from '@/lib/phoneAgent'
import { generateCancelToken } from '@/lib/security/resetToken'
import { generateRescheduleToken } from '@/lib/security/rescheduleToken'
import { bookingConfirmationEmail, bookingConfirmationResendSubject } from '@/lib/email/templates'
import { normalizeBookingLanguage } from '@/lib/bookingLanguage'
import { buildICS } from '@/lib/ics'
import { calculateReminders, normalizeReminderSettings } from '@/lib/reminders'
import { env, isFeatureEnabled } from '@/lib/env'
import { corsHeaders } from '@/lib/cors-allow'
import { isSubscribed } from '@/lib/subscription'
import { sendResendEmail } from '@/lib/resendSend'

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

// Subscription required error for agent routes
const SUBSCRIPTION_REQUIRED_ERROR = {
  ok: false,
  code: 'SUBSCRIPTION_REQUIRED',
  message: 'The business owner\'s subscription is not active.',
  hint: 'The business needs an active subscription to use AI phone agent features.'
}

export async function OPTIONS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    })
  })
}

export async function POST(request) {
  let resolvedHandle = null
  let agentLabel = null
  
  try {
    const body = await request.json()
    const { 
      agentApiKey, 
      handle, 
      start, 
      durationMinutes,
      guestName, 
      guestEmail, 
      guestPhone,
      notes,
      timezone,
      language: languageRaw
    } = body
    const language = normalizeBookingLanguage(languageRaw)

    // 1. Validate agentApiKey
    if (!agentApiKey) {
      logAgentCall('book', { success: false, error: 'Missing agentApiKey' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing agentApiKey.',
        hint: 'Provide agentApiKey in the request body.'
      }, { status: 400 })
    }

    const agentResult = await findAgentOwnerByKey(agentApiKey)
    
    if (!agentResult) {
      logAgentCall('book', { success: false, error: 'Invalid API key' })
      return NextResponse.json(AGENT_UNAUTHORIZED_ERROR, { status: 401 })
    }

    const { owner, agent } = agentResult
    agentLabel = agent.label || 'unnamed'
    
    // Check owner's subscription status
    if (!isSubscribed(owner)) {
      logAgentCall('book', { 
        handle: resolvedHandle, 
        agentLabel, 
        success: false, 
        error: 'Owner subscription not active' 
      })
      return NextResponse.json(SUBSCRIPTION_REQUIRED_ERROR, { status: 402 })
    }
    
    // 2. Resolve handle
    resolvedHandle = handle || agentResult.handle
    
    if (!resolvedHandle) {
      logAgentCall('book', { 
        handle: resolvedHandle, 
        agentLabel, 
        success: false, 
        error: 'No handle configured' 
      })
      return NextResponse.json({
        ok: false,
        code: 'HANDLE_NOT_CONFIGURED',
        message: 'No booking handle configured for this business.',
        hint: 'The business owner needs to set up their booking page handle.'
      }, { status: 400 })
    }

    // 3. Validate required fields
    if (!start) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Missing start' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing start time.',
        hint: 'Provide start as an ISO datetime (e.g., 2025-12-01T14:30:00-05:00).'
      }, { status: 400 })
    }

    if (!guestName) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Missing guestName' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing guest name.',
        hint: 'Provide guestName in the request body.'
      }, { status: 400 })
    }

    if (!guestEmail) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Missing guestEmail' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing guest email.',
        hint: 'Provide guestEmail in the request body.'
      }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(guestEmail)) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Invalid email format' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid email format.',
        hint: 'Provide a valid email address.'
      }, { status: 400 })
    }

    // 4. Parse and validate times
    const startTime = new Date(start)
    
    if (isNaN(startTime.getTime())) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Invalid start time' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid start time format.',
        hint: 'Provide start as an ISO datetime (e.g., 2025-12-01T14:30:00-05:00).'
      }, { status: 400 })
    }

    // Check if start is in the past
    if (startTime < new Date()) {
      logAgentCall('book', { handle: resolvedHandle, agentLabel, success: false, error: 'Start time in past' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Start time cannot be in the past.',
        hint: 'Choose a future date and time.'
      }, { status: 400 })
    }

    // 5. Calculate end time
    const settings = owner.scheduling || {}
    const duration = durationMinutes || settings.defaultDurationMin || 30
    const endTime = new Date(startTime.getTime() + duration * 60000)
    const hostTimezone = settings.timeZone || 'UTC'
    const resolvedTimezone = timezone || agentResult.timezone || hostTimezone

    const database = await connect()

    // 6. Check availability (FreeBusy)
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

        const selectedCalendarIds = settings.selectedCalendarIds || ['primary']
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
                logAgentCall('book', { 
                  handle: resolvedHandle, 
                  agentLabel, 
                  success: false, 
                  error: 'Slot taken' 
                })
                return NextResponse.json({
                  ok: false,
                  code: 'SLOT_TAKEN',
                  message: 'That time slot is no longer available. Please pick another time.'
                }, { status: 409 })
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[agent:book] FreeBusy check error:', error.message)
      // Continue anyway - we'll try to book
    }

    // 7. Create booking
    const bookingId = uuidv4()
    const cancelToken = generateCancelToken(bookingId, guestEmail)
    const rescheduleToken = isFeatureEnabled('RESCHEDULE') 
      ? generateRescheduleToken(bookingId, guestEmail) 
      : null
    
    // Get reminder preferences
    const reminderPrefs = normalizeReminderSettings(owner.scheduling?.reminders)
    
    // Calculate reminders if feature enabled
    const reminders = isFeatureEnabled('REMINDERS')
      ? calculateReminders(startTime.toISOString(), reminderPrefs)
      : []
    
    const bookingTitle = `Meeting with ${guestName}`
    
    console.log(`[agent:book] Creating booking for ${resolvedHandle}, guest: ${guestName}, source: phone-agent`)

    const booking = {
      id: bookingId,
      userId: owner.id,
      eventTypeId: null,
      eventTypeSlug: null,
      title: bookingTitle,
      customerName: guestName,
      guestEmail: guestEmail,
      guestPhone: guestPhone || null,
      guestTimezone: resolvedTimezone,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      timeZone: hostTimezone,
      notes: notes || '',
      language: language || 'en',
      status: 'confirmed',
      source: 'phone-agent',  // Tag for tracking phone agent bookings
      agentLabel: agentLabel,
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

    // 8. Create Google Calendar event
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

        const baseUrl = env.BASE_URL || 'https://book8-ai.vercel.app'
        const selectedCalendarIds = settings.selectedCalendarIds || ['primary']
        const targetCalendarId = selectedCalendarIds[0] || 'primary'

        const event = {
          summary: bookingTitle,
          description: `Guest: ${guestName}\nEmail: ${guestEmail}${guestPhone ? `\nPhone: ${guestPhone}` : ''}\n${notes ? `Notes: ${notes}\n` : ''}\n---\nSource: Phone Agent${agentLabel !== 'unnamed' ? ` (${agentLabel})` : ''}\nBooking ID: ${bookingId}\n\nManage: ${baseUrl}/bookings/reschedule/${rescheduleToken}`,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: hostTimezone
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: hostTimezone
          },
          attendees: [{ email: guestEmail }],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },
              { method: 'popup', minutes: 60 }
            ]
          }
        }

        const createdEvent = await calendar.events.insert({
          calendarId: targetCalendarId,
          requestBody: event,
          sendUpdates: 'all'
        })

        googleEventId = createdEvent.data.id
        googleCalendarId = targetCalendarId

        // Update booking with Google event ID
        await database.collection('bookings').updateOne(
          { id: bookingId },
          { 
            $set: { 
              googleEventId, 
              googleCalendarId,
              updatedAt: new Date().toISOString()
            } 
          }
        )

        console.log(`[agent:book] Google Calendar event created: ${googleEventId}`)
      }
    } catch (error) {
      console.error('[agent:book] Google Calendar error:', error.message)
      // Continue - booking is still valid
    }

    // 9. Send confirmation email (same template as web booking)
    try {
      if (!env.RESEND_API_KEY) {
        console.warn('[agent:book] RESEND_API_KEY not set, skipping confirmation email')
      } else {
        const baseUrl = env.BASE_URL || 'https://book8-ai.vercel.app'
        const { Resend } = await import('resend')
        const resend = new Resend(env.RESEND_API_KEY)

        const emailHtml = bookingConfirmationEmail(
          booking,
          owner,
          baseUrl,
          rescheduleToken,
          cancelToken,
          resolvedTimezone,
          null,
          null,
          language
        )

        const icsContent = buildICS({
          uid: `booking-${bookingId}@book8.io`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          summary: bookingTitle,
          description: `${notes || ''}\n\n---\nSource: Book8-AI Phone Agent\nBooking ID: ${bookingId}`,
          organizer: 'noreply@book8.io',
          attendees: [{ email: guestEmail, name: guestName }],
          method: 'REQUEST'
        })

        const emailSubject = bookingConfirmationResendSubject({
          businessLabel: owner.name || owner.email || 'Book8',
          startTime,
          guestTzLabel: resolvedTimezone,
          language
        })

        const emailOut = await sendResendEmail(resend, {
          from: 'Book8-AI <bookings@book8.io>',
          to: guestEmail,
          cc: owner.email,
          subject: emailSubject,
          html: emailHtml,
          attachments: [
            {
              filename: 'booking.ics',
              content: Buffer.from(icsContent).toString('base64')
            }
          ]
        })
        if (!emailOut.ok) {
          console.error('[agent:book] Resend rejected confirmation', {
            to: guestEmail,
            error: emailOut.error,
            statusCode: emailOut.statusCode,
            name: emailOut.name
          })
        } else {
          console.log(`[agent:book] Confirmation email sent to ${guestEmail}`, { id: emailOut.id })
        }
      }
    } catch (error) {
      console.error('[agent:book] Email error:', error.message)
      // Continue - booking is still valid
    }

    // 10. Return success response (LLM-friendly)
    logAgentCall('book', { 
      handle: resolvedHandle, 
      agentLabel, 
      success: true 
    })

    return NextResponse.json({
      ok: true,
      bookingId: bookingId,
      handle: resolvedHandle,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      hostTimezone: hostTimezone,
      guest: {
        name: guestName,
        email: guestEmail,
        phone: guestPhone || null
      }
    })

  } catch (error) {
    console.error('[agent:book] Error:', error)
    logAgentCall('book', { 
      handle: resolvedHandle, 
      agentLabel, 
      success: false, 
      error: error.message 
    })
    return NextResponse.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      hint: error.message
    }, { status: 500 })
  }
}
