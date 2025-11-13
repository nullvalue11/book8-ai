import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { buildICS } from '@/lib/ics'
import { verifyActionToken, verifyCancelToken } from '@/lib/security/resetToken'
import { renderHostCancel } from '@/lib/emailRenderer'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db
async function connect() { if (!client) { client = new MongoClient(env.MONGO_URL); await client.connect(); db = client.db(env.DB_NAME) } return db }

// New POST endpoint for modern cancel flow
export async function POST(request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Missing token' },
        { status: 400 }
      )
    }

    // Verify token
    const verification = verifyCancelToken(token)
    
    if (!verification.valid) {
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired token' },
        { status: 400 }
      )
    }

    const database = await connect()

    // Find booking by token
    const booking = await database.collection('bookings').findOne({ 
      cancelToken: token,
      status: { $ne: 'canceled' }
    })

    if (!booking) {
      return NextResponse.json(
        { ok: false, error: 'Booking not found or already canceled' },
        { status: 404 }
      )
    }

    // Delete Google event if present
    try {
      if (booking.googleEventId) {
        const { google } = await import('googleapis')
        const user = await database.collection('users').findOne({ id: booking.userId })
        
        if (user?.google?.refreshToken) {
          const oauth2 = new google.auth.OAuth2(
            env.GOOGLE?.CLIENT_ID, 
            env.GOOGLE?.CLIENT_SECRET, 
            env.GOOGLE?.REDIRECT_URI
          )
          oauth2.setCredentials({ refresh_token: user.google.refreshToken })
          const cal = google.calendar({ version: 'v3', auth: oauth2 })
          
          await cal.events.delete({ 
            calendarId: booking.googleCalendarId || 'primary', 
            eventId: booking.googleEventId 
          })
          
          console.log('[cancel] Google event deleted:', booking.googleEventId)
        }
      }
    } catch (e) {
      console.error('[cancel] Google delete failed:', e?.message || e)
    }

    // Update booking status
    await database.collection('bookings').updateOne(
      { id: booking.id },
      { 
        $set: { 
          status: 'canceled', 
          canceledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString() 
        } 
      }
    )

    // Send cancellation emails
    try {
      const user = await database.collection('users').findOne({ id: booking.userId })
      
      if (env.RESEND_API_KEY && user) {
        const { Resend } = await import('resend')
        const resend = new Resend(env.RESEND_API_KEY)
        
        // Generate cancellation ICS
        const ics = buildICS({ 
          uid: `booking-${booking.id}@book8.ai`,
          start: booking.startTime, 
          end: booking.endTime, 
          summary: booking.title, 
          description: booking.notes || '', 
          organizer: user.email, 
          attendees: [
            { email: booking.guestEmail, name: booking.customerName }
          ], 
          method: 'CANCEL' 
        })

        // Send to guest
        await resend.emails.send({ 
          from: 'Book8 AI <bookings@book8.ai>', 
          to: booking.guestEmail, 
          subject: `Meeting canceled: ${booking.title}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Meeting Canceled</h2>
              <p>Your meeting has been successfully canceled.</p>
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>${booking.title}</strong></p>
                <p>${new Date(booking.startTime).toLocaleString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit',
                  timeZone: booking.guestTimezone || booking.timeZone
                })}</p>
                <p style="color: #666; font-size: 14px;">${booking.guestTimezone || booking.timeZone}</p>
              </div>
              <p>This cancellation has been saved to your calendar.</p>
            </div>
          `,
          attachments: [{ 
            filename: 'canceled.ics', 
            content: Buffer.from(ics).toString('base64') 
          }] 
        })

        // Send to host
        if (renderHostCancel) {
          try {
            const hostEmailHtml = await renderHostCancel(booking, user, booking.guestTimezone)
            await resend.emails.send({
              from: 'Book8 AI <notifications@book8.ai>',
              to: user.email,
              subject: `Booking canceled: ${booking.customerName || 'Guest'} – ${booking.title}`,
              html: hostEmailHtml
            })
            console.log('[cancel] Host notification sent')
          } catch (hostError) {
            console.error('[cancel] Host notification error:', hostError.message)
          }
        }

        console.log('[cancel] Cancellation emails sent')
      }
    } catch (e) {
      console.error('[cancel] Email error:', e?.message || e)
    }

    return NextResponse.json({
      ok: true,
      message: 'Meeting canceled successfully'
    })

  } catch (error) {
    console.error('[cancel] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const token = url.searchParams.get('token')
    if (!id || !token) return new Response('<p>Invalid cancel link</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })

    const database = await connect()

    const marker = await database.collection('public_booking_tokens').findOne({ bookingId: id, purpose: 'cancel_booking' })
    if (!marker) return new Response('<p>Invalid or expired token</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })
    if (marker.used) return new Response('<p>Token already used</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })

    const v = verifyActionToken(token, 'cancel_booking')
    if (!v.valid) return new Response('<p>Invalid token</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })
    const ok = await bcrypt.compare(String(token), String(marker.tokenHash))
    if (!ok) return new Response('<p>Invalid token</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })

    const booking = await database.collection('bookings').findOne({ id })
    if (!booking) return new Response('<p>Booking not found</p>', { status: 404, headers: { 'Content-Type': 'text/html' } })

    // Delete Google event if present
    try {
      const map = await database.collection('google_events').findOne({ userId: booking.userId, bookingId: id })
      if (map?.googleEventId) {
        const { google } = await import('googleapis')
        const user = await database.collection('users').findOne({ id: booking.userId })
        const oauth2 = new google.auth.OAuth2(env.GOOGLE?.CLIENT_ID, env.GOOGLE?.CLIENT_SECRET, env.GOOGLE?.REDIRECT_URI)
        oauth2.setCredentials({ refresh_token: user?.google?.refreshToken })
        const cal = google.calendar({ version: 'v3', auth: oauth2 })
        await cal.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId })
        await database.collection('google_events').deleteOne({ userId: booking.userId, bookingId: id })
      }
    } catch (e) { console.error('[public/cancel] google delete failed', e?.message || e) }

    await database.collection('bookings').updateOne({ id }, { $set: { status: 'canceled', updatedAt: new Date().toISOString() } })
    await database.collection('public_booking_tokens').updateOne({ _id: marker._id }, { $set: { used: true, usedAt: new Date() } })

    // send cancellation emails
    try {
      const user = await database.collection('users').findOne({ id: booking.userId })
      const { Resend } = await import('resend')
      const resend = new Resend(env.RESEND_API_KEY)
      const ics = buildICS({ uid: booking.id, start: booking.startTime, end: booking.endTime, summary: booking.title, description: booking.notes, organizer: user.email, attendees: [{ email: user.email }, { email: booking.customerName ? `${booking.customerName} <${booking.customerEmail || ''}>` : (booking.customerEmail || '') }], method: 'CANCEL' })
      await resend.emails.send({ from: env.EMAIL_FROM, to: user.email, reply_to: env.EMAIL_REPLY_TO, subject: 'Booking canceled', html: `<p>The meeting ${booking.title} was canceled.</p>`, attachments: [{ filename: 'cancel.ics', content: Buffer.from(ics).toString('base64') }] })
      
      // Send host notification (synchronous)
      try {
        const hostEmailHtml = await renderHostCancel(booking, user, booking.guestTimezone)
        await resend.emails.send({
          from: 'Book8 AI <notifications@book8.ai>',
          to: user.email,
          subject: `Booking canceled: ${booking.customerName || 'Guest'} – ${booking.title}`,
          html: hostEmailHtml
        })
        console.log('[public/cancel] Host notification sent')
      } catch (hostError) {
        console.error('[public/cancel] Host notification error:', hostError.message)
      }
    } catch (e) { console.error('[public/cancel] email failed', e?.message || e) }

    return new Response('<p>Your meeting was canceled.</p>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (e) { console.error('[public/cancel] error', e); return new Response('<p>Server error</p>', { status: 500, headers: { 'Content-Type': 'text/html' } }) }
}
