import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyRescheduleToken, generateRescheduleToken } from '@/lib/security/rescheduleToken'
import { buildICS } from '@/lib/ics'
import { env } from '@/lib/env'

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

export async function POST(request) {
  try {
    const body = await request.json()
    const { token, newStart, newEnd, timezone } = body

    if (!token || !newStart || !newEnd) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify token
    const verification = verifyRescheduleToken(token)
    
    if (!verification.valid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Find booking by token
    const booking = await database.collection('bookings').findOne({ 
      rescheduleToken: token,
      status: 'confirmed'
    })

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found or cannot be rescheduled' },
        { status: 404 }
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

    // Get owner info
    const owner = await database.collection('users').findOne({ id: booking.userId })
    
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: 'Owner not found' },
        { status: 404 }
      )
    }

    // Check availability for new time
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
              
              // Skip if the busy slot is the current booking
              if (booking.googleEventId) {
                // Allow overlap with current booking's time slot
                const currentStart = new Date(booking.startTime)
                const currentEnd = new Date(booking.endTime)
                
                if (busyStart.getTime() === currentStart.getTime() && 
                    busyEnd.getTime() === currentEnd.getTime()) {
                  continue
                }
              }
              
              if (newStartTime < busyEnd && newEndTime > busyStart) {
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
      console.error('[reschedule] FreeBusy check error:', error.message)
    }

    // Store old times for email
    const oldStartTime = booking.startTime
    const oldEndTime = booking.endTime

    // Generate new reschedule token for future use
    const newRescheduleToken = generateRescheduleToken(booking.id, booking.guestEmail)

    // Update booking
    const rescheduleHistory = booking.rescheduleHistory || []
    rescheduleHistory.push({
      oldStart: oldStartTime,
      oldEnd: oldEndTime,
      newStart: newStartTime.toISOString(),
      newEnd: newEndTime.toISOString(),
      rescheduledAt: new Date().toISOString()
    })

    await database.collection('bookings').updateOne(
      { id: booking.id },
      { 
        $set: { 
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          guestTimezone: timezone || booking.guestTimezone,
          rescheduleToken: newRescheduleToken,
          rescheduleCount: (booking.rescheduleCount || 0) + 1,
          rescheduleHistory,
          updatedAt: new Date().toISOString() 
        } 
      }
    )

    // Update Google Calendar event
    try {
      if (booking.googleEventId && owner.google?.refreshToken) {
        const { google } = await import('googleapis')
        const oauth = new google.auth.OAuth2(
          env.GOOGLE?.CLIENT_ID,
          env.GOOGLE?.CLIENT_SECRET,
          env.GOOGLE?.REDIRECT_URI
        )
        oauth.setCredentials({ refresh_token: owner.google.refreshToken })
        const calendar = google.calendar({ version: 'v3', auth: oauth })

        const event = {
          summary: booking.title,
          description: `${booking.notes || ''}\n\n---\nSource: Book8 AI\nBooking ID: ${booking.id}\nRescheduled ${booking.rescheduleCount || 0} time(s)`,
          start: {
            dateTime: newStartTime.toISOString(),
            timeZone: owner.scheduling?.timeZone || 'UTC'
          },
          end: {
            dateTime: newEndTime.toISOString(),
            timeZone: owner.scheduling?.timeZone || 'UTC'
          },
          attendees: [{ email: booking.guestEmail }]
        }

        await calendar.events.update({
          calendarId: booking.googleCalendarId || 'primary',
          eventId: booking.googleEventId,
          requestBody: event
        })

        console.log('[reschedule] Google event updated:', booking.googleEventId)
      }
    } catch (error) {
      console.error('[reschedule] Google Calendar error:', error.message)
    }

    // Send reschedule confirmation emails
    try {
      if (env.RESEND_API_KEY) {
        const { Resend } = await import('resend')
        const resend = new Resend(env.RESEND_API_KEY)
        
        // Generate updated ICS
        const ics = buildICS({ 
          uid: `booking-${booking.id}@book8.ai`,
          start: newStartTime.toISOString(), 
          end: newEndTime.toISOString(), 
          summary: booking.title, 
          description: booking.notes || '', 
          organizer: owner.email, 
          attendees: [
            { email: booking.guestEmail, name: booking.customerName }
          ], 
          method: 'REQUEST' 
        })

        const guestTz = timezone || booking.guestTimezone || booking.timeZone

        // Send to guest
        await resend.emails.send({ 
          from: 'Book8 AI <bookings@book8.io>', 
          to: booking.guestEmail,
          cc: owner.email,
          subject: `Meeting rescheduled: ${booking.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Meeting Rescheduled</h2>
              <p>Your meeting has been successfully rescheduled to a new time.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>${booking.title}</strong></p>
                <p style="margin-top: 10px;"><strong>New time:</strong></p>
                <p>${new Date(newStartTime).toLocaleString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: guestTz
                })}</p>
                <p style="color: #666; font-size: 14px;">${guestTz}</p>
                
                <p style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;"><strong>Previous time:</strong></p>
                <p style="text-decoration: line-through; color: #999;">${new Date(oldStartTime).toLocaleString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: guestTz
                })}</p>
              </div>
              
              <p>The updated meeting has been saved to your calendar.</p>
            </div>
          `,
          attachments: [{ 
            filename: 'meeting.ics', 
            content: Buffer.from(ics).toString('base64') 
          }] 
        })

        console.log('[reschedule] Confirmation emails sent')
      }
    } catch (e) {
      console.error('[reschedule] Email error:', e?.message || e)
    }

    return NextResponse.json({
      ok: true,
      message: 'Meeting rescheduled successfully',
      booking: {
        id: booking.id,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString()
      }
    })

  } catch (error) {
    console.error('[reschedule] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
