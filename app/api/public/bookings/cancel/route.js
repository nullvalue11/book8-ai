import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { buildICS } from '@/app/lib/ics'
import { verifyActionToken } from '@/app/lib/security/resetToken'
import { renderHostCancel } from '@/app/lib/emailRenderer'
import { env } from '@/app/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db
async function connect() { if (!client) { client = new MongoClient(env.MONGO_URL); await client.connect(); db = client.db(env.DB_NAME) } return db }

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
