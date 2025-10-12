import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { buildGoogleEventFromBooking } from '../../../../../lib/googleSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client
let db
let indexesEnsured = false

async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!indexesEnsured) {
    try {
      await db.collection('google_events').createIndex({ userId: 1, bookingId: 1, calendarId: 1 }, { unique: true })
    } catch {}
    indexesEnsured = true
  }
  return db
}

export async function OPTIONS() { return new Response(null, { status: 204 }) }

function getJwtSecret() { return process.env.JWT_SECRET || 'dev-secret-change-me' }

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

async function getOAuth2Client() {
  try {
    const { google } = await import('googleapis')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) { console.error('[google/sync] oauth load failed', e?.message || e); return null }
}

async function getCalendarClientForUser(user) {
  try {
    const { google } = await import('googleapis')
    const refreshToken = user?.google?.refreshToken
    if (!refreshToken) return null
    const oauth = await getOAuth2Client()
    if (!oauth) return null
    oauth.setCredentials({ refresh_token: refreshToken })
    return google.calendar({ version: 'v3', auth: oauth })
  } catch (e) { console.error('[google/sync] calendar client failed', e?.message || e); return null }
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    const u = await database.collection('users').findOne({ id: auth.user.id })
    const connected = !!(u?.google?.refreshToken || u?.google?.connected)
    return NextResponse.json({ ok: true, connected, lastSyncedAt: u?.google?.lastSyncedAt || null })
  } catch (e) { console.error('[google/sync] GET error', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}

export async function POST(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    const user = await database.collection('users').findOne({ id: auth.user.id })
    const calendar = await getCalendarClientForUser(user)
    if (!calendar) return NextResponse.json({ ok: false, error: 'Google not connected' }, { status: 400 })

    const selected = user?.google?.selectedCalendarIds
    const calendarsUsed = Array.isArray(selected) && selected.length > 0 ? selected : ['primary']

    const bookings = await database.collection('bookings').find({ userId: auth.user.id }).toArray()
    const active = bookings.filter(b => b.status !== 'canceled')
    const canceled = bookings.filter(b => b.status === 'canceled')

    let created = 0, updated = 0, deleted = 0

    for (const b of active) {
      for (const calendarId of calendarsUsed) {
        const map = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id, calendarId })
        const evt = buildGoogleEventFromBooking(b)
        try {
          if (!map?.googleEventId) {
            const ins = await calendar.events.insert({ calendarId, requestBody: evt })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id, calendarId }, { $set: { userId: auth.user.id, bookingId: b.id, calendarId, googleEventId: ins.data.id, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
            console.info('[google/sync] inserted', calendarId, ins.data.id)
            created++
          } else {
            await calendar.events.patch({ calendarId, eventId: map.googleEventId, requestBody: evt })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id, calendarId }, { $set: { updatedAt: new Date() } })
            updated++
          }
        } catch (e) { console.error('[google/sync] upsert failed', calendarId, e?.message || e) }
      }
    }

    for (const b of canceled) {
      const maps = await database.collection('google_events').find({ userId: auth.user.id, bookingId: b.id }).toArray()
      for (const map of maps) {
        if (!map?.googleEventId) continue
        try {
          await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId })
          await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id, calendarId: map.calendarId })
          deleted++
        } catch (e) { console.error('[google/sync] delete failed', map.calendarId, e?.message || e) }
      }
    }

    await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
    console.info('[google/sync] summary', { created, updated, deleted, calendarsUsed })
    return NextResponse.json({ ok: true, created, updated, deleted, calendarsUsed })
  } catch (e) { console.error('[google/sync] POST error', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}
