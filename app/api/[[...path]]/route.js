/* eslint-disable no-console */
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../lib/baseUrl'
import { buildGoogleEventFromBooking } from '../../../lib/googleSync'

// Mongo connection
let client
let db
let indexesEnsured = false

async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL is missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME is missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!indexesEnsured) {
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true })
      await db.collection('bookings').createIndex({ userId: 1, startTime: 1 })
      await db.collection('status_checks').createIndex({ timestamp: -1 })
      await db.collection('google_events').createIndex({ userId: 1, bookingId: 1, calendarId: 1 }, { unique: true })
      await db.collection('stripe_events').createIndex({ eventId: 1 }, { unique: true })
      await db.collection('stripe_events').createIndex({ processedAt: -1 })
      await db.collection('billing_logs').createIndex({ userId: 1, timestamp: -1 })
      await db.collection('billing_logs').createIndex({ eventType: 1, timestamp: -1 })
    } catch {}
    indexesEnsured = true
  }
  return db
}

// Helpers
function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, stripe-signature, x-client-timezone')
  resp.headers.set('Access-Control-Allow-Credentials', 'true')
  return resp
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

const json = (data, init = {}) => cors(NextResponse.json(data, init))

function getJwtSecret() { return process.env.JWT_SECRET || 'dev-secret-change-me' }

async function getBody(request) { try { return await request.json() } catch { return {} } }

async function requireAuth(request, db) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await db.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

function isISODateString(s) { const d = new Date(s); return !isNaN(d.getTime()) }

// Stripe Idempotency Helpers
async function isStripeEventProcessed(database, eventId) { try { const existingEvent = await database.collection('stripe_events').findOne({ eventId }); return !!existingEvent } catch (error) { console.error('Error checking event idempotency:', error); return false } }
async function markStripeEventProcessed(database, eventId, eventType, eventData = {}) { try { await database.collection('stripe_events').insertOne({ eventId, eventType, eventData, processedAt: new Date(), createdAt: new Date() }); return true } catch (error) { console.error('Error marking event as processed:', error); return false } }
async function logBillingActivity(database, userId, eventType, eventId, details = {}, status = 'success') { try { await database.collection('billing_logs').insertOne({ id: uuidv4(), userId, eventType, eventId, details, status, timestamp: new Date(), createdAt: new Date() }) } catch (error) { console.error('Error logging billing activity:', error) } }
async function findUserByCustomerId(database, customerId) { try { const user = await database.collection('users').findOne({ 'subscription.customerId': customerId }); return user?.id || null } catch (error) { console.error('Error finding user by customer ID:', error); return null } }

// Google helpers (dynamic import)
async function getOAuth2Client() {
  try {
    const { google } = await import('googleapis')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) { console.error('[bookings] googleapis load failed', e?.message || e); return null }
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
  } catch (e) { console.error('[bookings] calendar client failed', e?.message || e); return null }
}

// Router entrypoints
export async function GET(request, ctx) { return handleRoute(request, ctx) }
export async function POST(request, ctx) { return handleRoute(request, ctx) }
export async function PUT(request, ctx) { return handleRoute(request, ctx) }
export async function DELETE(request, ctx) { return handleRoute(request, ctx) }
export async function PATCH(request, ctx) { return handleRoute(request, ctx) }

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  console.log(`API Request: ${method} ${route}`)

  // NOTE: We intentionally do NOT shadow /api/search/* here anymore.
  // Dedicated route files under app/api/search/* must handle those.

  try {
    const database = await connectToMongo()

    // Health
    if ((route === '/health' || route === '/root' || route === '/') && method === 'GET') {
      try { await database.command({ ping: 1 }); return json({ ok: true, message: 'Book8 API online' }) } catch { return json({ ok: false }, { status: 500 }) }
    }

    // Auth (kept for backward compatibility; dedicated routes also exist)
    if (route === '/auth/register' && method === 'POST') {
      const { email, password, name } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const hashed = await bcrypt.hash(password, 10)
      const user = { id: uuidv4(), email: String(email).toLowerCase(), name: name || '', passwordHash: hashed, createdAt: new Date(), subscription: null, google: null }
      try { await database.collection('users').insertOne(user) } catch (e) { if (String(e?.message || '').includes('duplicate')) return json({ error: 'Email already registered' }, { status: 409 }); throw e }
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ token, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription, google: { connected: false, lastSyncedAt: null } } })
    }
    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return json({ error: 'Invalid credentials' }, { status: 401 })
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      const googleSafe = user.google ? { connected: !!user.google?.refreshToken, lastSyncedAt: user.google?.lastSyncedAt || null } : { connected: false, lastSyncedAt: null }
      return json({ token, user: { id: user.id, email: user.email, name: user.name || '', subscription: user.subscription || null, google: googleSafe } })
    }

    // Bookings list
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await database.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Bookings create
    if (route === '/bookings' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const body = await getBody(request)
      const { title, customerName, startTime, endTime, notes, timeZone } = body || {}
      if (!title || !startTime || !endTime) return json({ error: 'title, startTime, endTime are required' }, { status: 400 })
      const s = new Date(startTime); const e = new Date(endTime)
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return json({ error: 'Invalid date format' }, { status: 400 })
      if (e <= s) return json({ error: 'endTime must be after startTime' }, { status: 400 })
      const headerTz = request.headers.get('x-client-timezone') || undefined
      const tz = (timeZone || headerTz || 'UTC').toString()
      const booking = { id: uuidv4(), userId: auth.user.id, title, customerName: customerName || '', startTime: s.toISOString(), endTime: e.toISOString(), status: 'scheduled', notes: notes || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'book8', conflict: false, timeZone: tz }

      try { await database.collection('bookings').insertOne(booking) } catch (e) { console.error('DB insert booking error', e); return json({ error: 'Failed to save booking' }, { status: 500 }) }

      // Attempt Google insert to selected calendars
      try {
        const userDoc = await database.collection('users').findOne({ id: auth.user.id })
        const calendar = await getCalendarClientForUser(userDoc)
        const selected = (userDoc?.scheduling?.selectedCalendarIds && userDoc.scheduling.selectedCalendarIds.length)
          ? userDoc.scheduling.selectedCalendarIds
          : (userDoc?.google?.selectedCalendarIds && userDoc.google.selectedCalendarIds.length ? userDoc.google.selectedCalendarIds : ['primary'])
        if (calendar && selected?.length) {
          const evt = buildGoogleEventFromBooking(booking)
          for (const calendarId of selected) {
            try {
              const ins = await calendar.events.insert({ calendarId, requestBody: evt })
              await database.collection('google_events').updateOne(
                { userId: auth.user.id, bookingId: booking.id, calendarId },
                { $set: { userId: auth.user.id, bookingId: booking.id, calendarId, googleEventId: ins?.data?.id || null, createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true }
              )
              console.info('[bookings] inserted event', calendarId, ins?.data?.id)
            } catch (e) { console.error('[bookings] google insert failed', calendarId, e?.message || e) }
          }
          await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
        }
      } catch (e) { console.error('[bookings] google client error', e?.message || e) }

      return json(booking)
    }

    // Bookings update
    if (route.startsWith('/bookings/') && (method === 'PUT' || method === 'PATCH')) {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const body = await getBody(request)
      const patch = {}
      if (body.title !== undefined) patch.title = body.title
      if (body.customerName !== undefined) patch.customerName = body.customerName
      if (body.startTime) { const d = new Date(body.startTime); if (isNaN(d.getTime())) return json({ error: 'Invalid startTime' }, { status: 400 }); patch.startTime = d.toISOString() }
      if (body.endTime) { const d = new Date(body.endTime); if (isNaN(d.getTime())) return json({ error: 'Invalid endTime' }, { status: 400 }); patch.endTime = d.toISOString() }
      if (body.timeZone) patch.timeZone = String(body.timeZone)
      if (patch.startTime && patch.endTime) { if (new Date(patch.endTime) <= new Date(patch.startTime)) return json({ error: 'endTime must be after startTime' }, { status: 400 }) }
      patch.updatedAt = new Date().toISOString()
      const resDoc = await database.collection('bookings').findOneAndUpdate({ id, userId: auth.user.id }, { $set: patch }, { returnDocument: 'after' })
      if (!resDoc.value) return json({ error: 'Booking not found' }, { status: 404 })
      const { _id, ...rest } = resDoc.value
      return json(rest)
    }

    // Bookings delete
    if (route.startsWith('/bookings/') && method === 'DELETE') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const existing = await database.collection('bookings').findOne({ id, userId: auth.user.id })
      if (!existing) return json({ error: 'Booking not found' }, { status: 404 })
      await database.collection('bookings').updateOne({ id, userId: auth.user.id }, { $set: { status: 'canceled', updatedAt: new Date().toISOString() } })
      const updated = await database.collection('bookings').findOne({ id, userId: auth.user.id })
      const { _id, ...rest } = updated
      return json(rest)
    }

    // Fallback
    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) {
    console.error('API Error (outer):', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
