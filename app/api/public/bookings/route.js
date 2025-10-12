import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import { buildICS } from '@/app/lib/ics'
import { signActionToken, ttlMinutes } from '@/app/lib/security/resetToken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client, db, indexed = false
async function connect() { if (!client) { client = new MongoClient(process.env.MONGO_URL); await client.connect(); db = client.db(process.env.DB_NAME) } if (!indexed) { try { await db.collection('public_booking_tokens').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }); await db.collection('rate_limits').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }); } catch{} indexed = true } return db }

export async function OPTIONS() { return new Response(null, { status: 204 }) }

async function getCalendarClient(user) {
  try {
    const { google } = await import('googleapis')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    if (!user?.google?.refreshToken) return null
    oauth2.setCredentials({ refresh_token: user.google.refreshToken })
    return { cal: google.calendar({ version: 'v3', auth: oauth2 }), google }
  } catch { return null }
}

export async function POST(req) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
    const database = await connect()

    // rate limit: 10 per 10 minutes per IP
    const now = new Date()
    const windowEnd = new Date(Date.now() + 10 * 60 * 1000)
    const rlKey = `pub_book_${ip}`
    await database.collection('rate_limits').insertOne({ key: rlKey, createdAt: now, expireAt: windowEnd })
    const rlCount = await database.collection('rate_limits').countDocuments({ key: rlKey, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } })
    if (rlCount > 10) return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })

    const { handle, slotStart, slotEnd, guest } = await req.json()
    if (!handle || !slotStart || !slotEnd || !guest?.email) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })

    const user = await database.collection('users').findOne({ 'scheduling.handleLower': String(handle).toLowerCase() })
    if (!user) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

    const calIds = user.scheduling?.selectedCalendarIds?.length ? user.scheduling.selectedCalendarIds : (user.google?.selectedCalendarIds || ['primary'])
    const cg = await getCalendarClient(user)
    if (!cg) return NextResponse.json({ ok: false, error: 'Owner not connected to Google' }, { status: 400 })
    try {
      const fb = await cg.cal.freebusy.query({ requestBody: { timeMin: new Date(slotStart).toISOString(), timeMax: new Date(slotEnd).toISOString(), items: calIds.map(id => ({ id })) } })
      const cl = fb.data.calendars || {}
      const busy = Object.values(cl).flatMap(c => c.busy || [])
      const hasOverlap = busy.some(b => new Date(b.start) < new Date(slotEnd) && new Date(slotStart) < new Date(b.end))
      if (hasOverlap) return NextResponse.json({ ok: false, error: 'Slot no longer available' }, { status: 409 })
    } catch (e) { console.error('[public/bookings] freebusy failed', e?.message || e) }

    const booking = {
      id: uuidv4(), userId: user.id,
      title: `Meeting with ${guest.name || 'Guest'}`,
      customerName: guest.name || '',
      startTime: new Date(slotStart).toISOString(), endTime: new Date(slotEnd).toISOString(),
      status: 'scheduled', notes: guest.notes || '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      source: 'public', timeZone: user.scheduling?.timeZone || 'UTC'
    }
    await database.collection('bookings').insertOne(booking)

    let eventId = null
    const calendarId = (Array.isArray(calIds) && calIds.length ? calIds[0] : 'primary')
    try {
      const evt = { summary: `Book8 – ${booking.title}`, description: `Guest: ${guest.name || ''} (${guest.email})\nNotes: ${guest.notes || ''}`,
        start: { dateTime: booking.startTime, timeZone: booking.timeZone }, end: { dateTime: booking.endTime, timeZone: booking.timeZone }, attendees: [{ email: user.email }, { email: guest.email }] }
      const ins = await cg.cal.events.insert({ calendarId, requestBody: evt })
      eventId = ins?.data?.id || null
      await database.collection('google_events').updateOne({ userId: user.id, bookingId: booking.id, calendarId }, { $set: { userId: user.id, bookingId: booking.id, calendarId, googleEventId: eventId, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
      console.info('[public/bookings] inserted event', calendarId, eventId)
    } catch (e) { console.error('[public/bookings] insert failed', e?.message || e) }

    // cancel / reschedule tokens
    const cancelTok = signActionToken({ sub: booking.id, purpose: 'cancel_booking', ttlMinutes: 60 * 24 * 30, extra: { email: guest.email } })
    const tokenHash = await bcrypt.hash(cancelTok.token, 10)
    await database.collection('public_booking_tokens').insertOne({ bookingId: booking.id, purpose: 'cancel_booking', tokenHash, used: false, createdAt: new Date(), expireAt: new Date(cancelTok.payload.exp * 1000) })

    const base = process.env.APP_BASE_URL || ''
    const cancelLink = `${base}/api/public/bookings/cancel?id=${encodeURIComponent(booking.id)}&token=${encodeURIComponent(cancelTok.token)}`

    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      const ics = buildICS({ uid: booking.id, start: booking.startTime, end: booking.endTime, summary: booking.title, description: booking.notes, organizer: user.email, attendees: [{ email: user.email }, { email: guest.email }] })
      await resend.emails.send({ from: process.env.EMAIL_FROM, to: guest.email, cc: user.email, reply_to: process.env.EMAIL_REPLY_TO, subject: 'Your Book8 meeting is confirmed', html: `<p>Hi ${guest.name || ''},</p><p>Your meeting is confirmed.</p><p>${new Date(booking.startTime).toLocaleString()} – ${new Date(booking.endTime).toLocaleString()} (${booking.timeZone})</p><p><a href="${cancelLink}">Cancel meeting</a> (reschedule coming soon)</p>`, attachments: [{ filename: 'invite.ics', content: Buffer.from(ics).toString('base64') }] })
    } catch (e) { console.error('[public/bookings] email failed', e?.message || e) }

    return NextResponse.json({ ok: true, bookingId: booking.id, eventId })
  } catch (e) { console.error('[public/bookings] error', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}
