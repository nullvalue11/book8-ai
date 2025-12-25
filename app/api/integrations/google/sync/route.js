import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { buildGoogleEventFromBooking } from '../../../../../lib/googleSync'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client
let db
let indexesEnsured = false

// Subscription required error
function subscriptionRequiredResponse(feature) {
  return NextResponse.json({
    ok: false,
    error: 'Subscription required',
    code: 'SUBSCRIPTION_REQUIRED',
    feature: feature,
    message: `An active subscription is required to access ${feature} features. Please subscribe at /pricing`
  }, { status: 402 })
}

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
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

function getJwtSecret() { return env.JWT_SECRET || 'dev-secret-change-me' }

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
    const clientId = env.GOOGLE?.CLIENT_ID
    const clientSecret = env.GOOGLE?.CLIENT_SECRET
    const redirectUri = env.GOOGLE?.REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) { console.error('[google/sync] oauth load failed', e?.message || e); return null }
}

async function getCalendarClientForUser(user, database) {
  try {
    const { google } = await import('googleapis')
    const refreshToken = user?.google?.refreshToken
    if (!refreshToken) return { error: 'NO_REFRESH_TOKEN' }
    
    const oauth = await getOAuth2Client()
    if (!oauth) return { error: 'OAUTH_CONFIG_MISSING' }
    
    oauth.setCredentials({ refresh_token: refreshToken })
    
    // Test token by attempting a simple API call
    try {
      const calendar = google.calendar({ version: 'v3', auth: oauth })
      await calendar.calendarList.list({ maxResults: 1 })
      return { calendar }
    } catch (testError) {
      // Check for invalid_grant error
      if (testError?.message?.includes('invalid_grant') || testError?.code === 401) {
        console.error('[google/sync] invalid_grant detected - marking for reconnect')
        // Mark user as needing reconnect
        await database.collection('users').updateOne(
          { id: user.id },
          { $set: { 'google.needsReconnect': true, 'google.lastError': new Date().toISOString() } }
        )
        return { error: 'GOOGLE_INVALID_GRANT', needsReconnect: true }
      }
      throw testError
    }
  } catch (e) { 
    console.error('[google/sync] calendar client failed', e?.message || e)
    return { error: 'CALENDAR_CLIENT_FAILED' }
  }
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
    const calendarResult = await getCalendarClientForUser(user, database)
    
    if (calendarResult.error) {
      const statusCode = calendarResult.error === 'GOOGLE_INVALID_GRANT' ? 401 : 400
      return NextResponse.json({ 
        ok: false, 
        code: calendarResult.error,
        error: calendarResult.error === 'GOOGLE_INVALID_GRANT' 
          ? 'Google authorization expired. Please reconnect.' 
          : 'Google not connected',
        needsReconnect: calendarResult.needsReconnect || false
      }, { status: statusCode })
    }
    
    const calendar = calendarResult.calendar

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

    // Idempotent watch channel cleanup
    for (const b of canceled) {
      const maps = await database.collection('google_events').find({ userId: auth.user.id, bookingId: b.id }).toArray()
      for (const map of maps) {
        if (!map?.googleEventId) continue
        try {
          await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId })
          await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id, calendarId: map.calendarId })
          deleted++
        } catch (e) {
          // Treat 404/410 as idempotent success (resource already deleted)
          if (e?.code === 404 || e?.code === 410 || e?.message?.includes('Resource has been deleted')) {
            console.info('[google/sync] event already deleted (idempotent)', map.calendarId, map.googleEventId)
            await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id, calendarId: map.calendarId })
            deleted++
          } else {
            console.error('[google/sync] delete failed', map.calendarId, e?.message || e)
          }
        }
      }
    }

    await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
    console.info('[google/sync] summary', { created, updated, deleted, calendarsUsed })
    return NextResponse.json({ ok: true, created, updated, deleted, calendarsUsed })
  } catch (e) { console.error('[google/sync] POST error', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}
