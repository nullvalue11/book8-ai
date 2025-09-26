import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { buildGoogleEventFromBooking } from '../../../../lib/googleSync'

export const runtime = 'nodejs'

let client
let db
let indexes = false

async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!indexes) {
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true })
      await db.collection('bookings').createIndex({ userId: 1, startTime: 1 })
      await db.collection('google_events').createIndex({ userId: 1, bookingId: 1 }, { unique: true })
      await db.collection('cron_logs').createIndex({ startedAt: -1 })
    } catch {}
    indexes = true
  }
  return db
}

function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  resp.headers.set('Access-Control-Allow-Credentials', 'true')
  return resp
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

function json(data, init = {}) { return cors(NextResponse.json(data, init)) }

async function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  try {
    const { google } = await import('googleapis')
    if (!clientId || !clientSecret) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) {
    console.error('[Cron] Failed to load googleapis dynamically', e?.message || e)
    return null
  }
}

async function getGoogleClientForUser(userId) {
  const db = await connectToMongo()
  const user = await db.collection('users').findOne({ id: userId })
  const refreshToken = user?.google?.refreshToken
  if (!refreshToken) return null
  const o = await getOAuth2Client()
  if (!o) return null
  o.setCredentials({ refresh_token: refreshToken })
  try {
    const { google } = await import('googleapis')
    return google.calendar({ version: 'v3', auth: o })
  } catch (e) {
    console.error('[Cron] Failed to load calendar client dynamically', e?.message || e)
    return null
  }
}

export async function GET(request) {
  try {
    const db = await connectToMongo()
    const url = new URL(request.url)
    const secret = url.searchParams.get('secret')
    const cronHeader = request.headers.get('x-vercel-cron')

    if (!secret && !cronHeader) return json({ error: 'Unauthorized' }, { status: 401 })
    if (secret && process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) return json({ error: 'Unauthorized' }, { status: 401 })

    const logsEnabled = String(process.env.CRON_LOGS || '').toLowerCase() === 'true'
    const runId = uuidv4()
    if (logsEnabled) await db.collection('cron_logs').insertOne({ runId, startedAt: new Date(), triggeredBy: cronHeader ? 'vercel' : 'external' })

    const users = await db.collection('users').find({ 'google.refreshToken': { $exists: true, $ne: null } }).limit(50).toArray()
    let processed = 0
    for (const u of users) {
      try {
        const calendar = await getGoogleClientForUser(u.id)
        if (!calendar) continue
        const all = await db.collection('bookings').find({ userId: u.id }).toArray()
        const active = all.filter(b => b.status !== 'canceled')
        const canceled = all.filter(b => b.status === 'canceled')
        // upsert active
        for (const b of active) {
          const map = await db.collection('google_events').findOne({ userId: u.id, bookingId: b.id })
          const evt = buildGoogleEventFromBooking(b)
          if (!map?.googleEventId) {
            const ins = await calendar.events.insert({ calendarId: map?.calendarId || 'primary', requestBody: evt })
            await db.collection('google_events').updateOne(
              { userId: u.id, bookingId: b.id },
              { $set: { userId: u.id, bookingId: b.id, googleEventId: ins.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } },
              { upsert: true }
            )
          } else {
            await calendar.events.patch({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId, requestBody: evt })
            await db.collection('google_events').updateOne({ userId: u.id, bookingId: b.id }, { $set: { updatedAt: new Date() } })
          }
        }
        // delete canceled
        for (const b of canceled) {
          const map = await db.collection('google_events').findOne({ userId: u.id, bookingId: b.id })
          if (map?.googleEventId) {
            try { await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId }) } catch {}
            await db.collection('google_events').deleteOne({ userId: u.id, bookingId: b.id })
          }
        }
        await db.collection('users').updateOne({ id: u.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
        processed++
      } catch {}
    }

    if (logsEnabled) await db.collection('cron_logs').updateOne({ runId }, { $set: { finishedAt: new Date(), processed } })

    return json({ ok: true, processed })
  } catch (e) {
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}