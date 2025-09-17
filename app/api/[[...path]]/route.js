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
      await db.collection('google_events').createIndex({ userId: 1, bookingId: 1 }, { unique: true })
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

async function getBody(request) {
  try { return await request.json() } catch { return {} }
}

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

function getOAuth2Client() {
  // Dynamic import to avoid compilation issues
  return null // Temporarily disabled
}

function getGoogleScopes() { return ['https://www.googleapis.com/auth/calendar'] }

async function getGoogleClientForUser(userId) {
  // Temporarily disabled to avoid compilation issues
  return null
}

// Stripe (temporarily disabled to avoid compilation issues)
let stripe = null
function getStripe() {
  return null
}

// Router
export async function GET(request, ctx) { return handleRoute(request, ctx) }
export async function POST(request, ctx) { return handleRoute(request, ctx) }
export async function PUT(request, ctx) { return handleRoute(request, ctx) }
export async function DELETE(request, ctx) { return handleRoute(request, ctx) }
export async function PATCH(request, ctx) { return handleRoute(request, ctx) }

async function handleRoute(request, { params }) {
  const { path = [] } = params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const database = await connectToMongo()

    // Health
    if ((route === '/health' || route === '/root' || route === '/') && method === 'GET') {
      try { await database.command({ ping: 1 }); return json({ ok: true, message: 'Book8 API online' }) } catch { return json({ ok: false }, { status: 500 }) }
    }

    // Status
    if (route === '/status' && method === 'POST') {
      const body = await getBody(request)
      if (!body.client_name) return json({ error: 'client_name is required' }, { status: 400 })
      const statusObj = { id: uuidv4(), client_name: body.client_name, timestamp: new Date() }
      await database.collection('status_checks').insertOne(statusObj)
      return json(statusObj)
    }
    if (route === '/status' && method === 'GET') {
      const items = await database.collection('status_checks').find({}).limit(1000).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Auth
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

    // User profile
    if (route === '/user' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const u = await database.collection('users').findOne({ id: auth.user.id })
      if (!u) return json({ error: 'User not found' }, { status: 404 })
      const safe = { id: u.id, email: u.email, name: u.name || '', subscription: u.subscription || null, google: { connected: !!u.google?.refreshToken, lastSyncedAt: u.google?.lastSyncedAt || null } }
      return json(safe)
    }

    // Bookings list (merge with Google marked externally via client refresh)
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await database.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Bookings create (with logging + safe Google push)
    if (route === '/bookings' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })

      // Basic request logging for prod debugging
      try {
        console.log('POST /bookings headers', {
          authorization: request.headers.get('authorization') || null,
          contentType: request.headers.get('content-type') || null,
          accept: request.headers.get('accept') || null,
          clientTz: request.headers.get('x-client-timezone') || null,
        })
      } catch {}

      const body = await getBody(request)
      const { title, customerName, startTime, endTime, notes, timeZone } = body || {}
      try { console.log('POST /bookings body', { title, customerName, startTime, endTime, timeZone }) } catch {}

      if (!title || !startTime || !endTime) return json({ error: 'title, startTime, endTime are required' }, { status: 400 })
      const s = new Date(startTime); const e = new Date(endTime)
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return json({ error: 'Invalid date format' }, { status: 400 })
      if (e <= s) return json({ error: 'endTime must be after startTime' }, { status: 400 })

      const headerTz = request.headers.get('x-client-timezone') || undefined
      const tz = (timeZone || headerTz || 'UTC').toString()
      const booking = {
        id: uuidv4(), userId: auth.user.id, title,
        customerName: customerName || '', startTime: s.toISOString(), endTime: e.toISOString(),
        status: 'scheduled', notes: notes || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        source: 'book8', conflict: false, timeZone: tz,
      }

      try { await database.collection('bookings').insertOne(booking) } catch (e) {
        console.error('DB insert booking error', e)
        return json({ error: 'Failed to save booking' }, { status: 500 })
      }

      // Safe Google push
      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          try {
            const res = await calendar.events.insert({ calendarId: 'primary', requestBody: buildGoogleEventFromBooking(booking) })
            await database.collection('google_events').updateOne(
              { userId: auth.user.id, bookingId: booking.id },
              { $set: { userId: auth.user.id, bookingId: booking.id, googleEventId: res.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } },
              { upsert: true }
            )
          } catch (gerr) {
            console.error('Google push error', gerr?.message || gerr)
          }
        }
      } catch (outer) {
        console.error('Google client error', outer?.message || outer)
      }

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

      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          const mapping = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: id })
          if (mapping?.googleEventId) {
            await calendar.events.patch({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId, requestBody: buildGoogleEventFromBooking(rest) })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: id }, { $set: { updatedAt: new Date() } })
          } else {
            const ins = await calendar.events.insert({ calendarId: 'primary', requestBody: buildGoogleEventFromBooking(rest) })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: id }, { $set: { userId: auth.user.id, bookingId: id, googleEventId: ins.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
          }
        }
      } catch (gerr) { console.error('Google update error', gerr?.message || gerr) }

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
      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          const mapping = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: id })
          if (mapping?.googleEventId) {
            try { await calendar.events.delete({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId }) } catch {}
            await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: id })
          }
        }
      } catch (gerr) { console.error('Google delete error', gerr?.message || gerr) }
      const updated = await database.collection('bookings').findOne({ id, userId: auth.user.id })
      const { _id, ...rest } = updated
      return json(rest)
    }

    // Google sync endpoints
    if (route === '/integrations/google/sync' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json({ error: 'Google not connected', reconnect: true }, { status: 400 })
      const allBookings = await database.collection('bookings').find({ userId: auth.user.id }).toArray()
      const active = allBookings.filter(b => b.status !== 'canceled')
      const canceled = allBookings.filter(b => b.status === 'canceled')
      let created = 0, updatedCount = 0, deleted = 0
      for (const b of active) {
        const map = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id })
        const evt = buildGoogleEventFromBooking(b)
        try {
          if (!map?.googleEventId) {
            const ins = await calendar.events.insert({ calendarId: map?.calendarId || 'primary', requestBody: evt })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id }, { $set: { userId: auth.user.id, bookingId: b.id, googleEventId: ins.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
            created++
          } else {
            await calendar.events.patch({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId, requestBody: evt })
            await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id }, { $set: { updatedAt: new Date() } })
            updatedCount++
          }
        } catch {}
      }
      for (const b of canceled) {
        const map = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id })
        if (!map?.googleEventId) continue
        try { await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId }); await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id }); deleted++ } catch {}
      }
      await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
      return json({ ok: true, created, updated: updatedCount, deleted })
    }
    if (route === '/integrations/google/sync' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const u = await database.collection('users').findOne({ id: auth.user.id })
      return json({ connected: !!u?.google?.refreshToken, lastSyncedAt: u?.google?.lastSyncedAt || null })
    }

    // Billing (kept but minimized)
    if (route === '/billing/portal' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const s = getStripe(); if (!s) return json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, { status: 400 })
      const user = await database.collection('users').findOne({ id: auth.user.id })
      const customerId = user?.subscription?.customerId
      if (!customerId) return json({ error: 'No subscription found' }, { status: 400 })
      const base = getBaseUrl(headers().get('host') || undefined)
      try { const session = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${base}/?portal_return=true` }); return json({ url: session.url }) } catch { return json({ error: 'Failed to create portal session' }, { status: 500 }) }
    }

    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) {
    console.error('API Error (outer):', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}