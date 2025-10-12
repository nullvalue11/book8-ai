import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db
async function connect() { if (!client) { client = new MongoClient(process.env.MONGO_URL); await client.connect(); db = client.db(process.env.DB_NAME) } return db }

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const token = url.searchParams.get('token')
    if (!id || !token) return new Response('<p>Invalid cancel link</p>', { status: 400, headers: { 'Content-Type': 'text/html' } })

    const database = await connect()
    const booking = await database.collection('bookings').findOne({ id })
    if (!booking) return new Response('<p>Booking not found</p>', { status: 404, headers: { 'Content-Type': 'text/html' } })

    // For Phase A, skip signed token validation details. Mark canceled and delete Google event if mapped.
    const map = await database.collection('google_events').findOne({ userId: booking.userId, bookingId: id })
    try {
      if (map?.googleEventId) {
        const { google } = await import('googleapis')
        const user = await database.collection('users').findOne({ id: booking.userId })
        const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
        oauth2.setCredentials({ refresh_token: user?.google?.refreshToken })
        const cal = google.calendar({ version: 'v3', auth: oauth2 })
        await cal.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId })
        await database.collection('google_events').deleteOne({ userId: booking.userId, bookingId: id })
      }
    } catch (e) { console.error('[public/cancel] google delete failed', e?.message || e) }

    await database.collection('bookings').updateOne({ id }, { $set: { status: 'canceled', updatedAt: new Date().toISOString() } })

    return new Response('<p>Your meeting was canceled.</p>', { status: 200, headers: { 'Content-Type': 'text/html' } })
  } catch (e) { console.error('[public/cancel] error', e); return new Response('<p>Server error</p>', { status: 500, headers: { 'Content-Type': 'text/html' } }) }
}
