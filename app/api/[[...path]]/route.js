import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../lib/baseUrl'
import { google } from 'googleapis'
import { buildGoogleEventFromBooking, overlaps, mergeBook8WithGoogle } from '../../../lib/googleSync'

// Stripe init (safe even if key missing; we check before calls)
let stripe = null
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) return null
    stripe = new Stripe(key)
  }
  return stripe
}

// Single Mongo connection reused across invocations
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
    } catch (e) { }
    indexesEnsured = true
  }
  return db
}

// Helpers
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() { return handleCORS(new NextResponse(null, { status: 200 })) }

const json = (data, init = {}) => handleCORS(NextResponse.json(data, init))

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
  } catch (e) { return { error: 'Invalid or expired token', status: 401 } }
}

function getPriceId(plan) {
  const map = { starter: process.env.STRIPE_PRICE_STARTER, growth: process.env.STRIPE_PRICE_GROWTH, enterprise: process.env.STRIPE_PRICE_ENTERPRISE }
  return map[plan]
}

// Google helpers
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(headers().get('host') || undefined)}/api/integrations/google/callback`
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

function getGoogleScopes() { return ['https://www.googleapis.com/auth/calendar'] }

async function getGoogleClientForUser(userId) {
  const db = await connectToMongo()
  const user = await db.collection('users').findOne({ id: userId })
  const refreshToken = user?.google?.refreshToken
  if (!refreshToken) return null
  const oauth2Client = getOAuth2Client()
  if (!oauth2Client) return null
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

// Helper: find Google event by our private extended property if mapping missing
async function findGoogleEventIdByPrivate(calendar, calendarId, bookingId, startTime, endTime) {
  try {
    const params = {
      calendarId: calendarId || 'primary',
      privateExtendedProperty: [`book8BookingId=${bookingId}`],
      maxResults: 5,
      singleEvents: true,
    }
    if (startTime) params.timeMin = new Date(startTime).toISOString()
    if (endTime) params.timeMax = new Date(new Date(endTime).getTime() + 1).toISOString()
    const res = await calendar.events.list(params)
    const first = res?.data?.items?.[0]
    return first?.id || null
  } catch (e) {
    return null
  }
}

// Router handlers
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
    const db = await connectToMongo()

    // Health
    if ((route === '/health' || route === '/root' || route === '/') && method === 'GET') {
      try { await db.command({ ping: 1 }); return json({ ok: true, message: 'Book8 API online' }) } catch { return json({ ok: false }, { status: 500 }) }
    }

    // Auth endpoints
    if (route === '/auth/register' && method === 'POST') {
      const { email, password, name } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const hashed = await bcrypt.hash(password, 10)
      const user = { id: uuidv4(), email: String(email).toLowerCase(), name: name || '', passwordHash: hashed, createdAt: new Date(), subscription: null, google: null }
      try { await db.collection('users').insertOne(user) } catch (e) { if (String(e?.message || '').includes('duplicate')) return json({ error: 'Email already registered' }, { status: 409 }); throw e }
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ token, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription, google: { connected: false, lastSyncedAt: null } } })
    }
    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const user = await db.collection('users').findOne({ email: String(email).toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return json({ error: 'Invalid credentials' }, { status: 401 })
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      const googleSafe = user.google ? { connected: !!user.google?.refreshToken, lastSyncedAt: user.google?.lastSyncedAt || null } : { connected: false, lastSyncedAt: null }
      return json({ token, user: { id: user.id, email: user.email, name: user.name || '', subscription: user.subscription || null, google: googleSafe } })
    }

    // Bookings list (with Google merge + conflict badges both sides)
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await db.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      let book8 = items.map(({ _id, ...rest }) => ({ ...rest, source: 'book8', conflict: false }))

      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json(book8)

      try {
        const now = new Date(); const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const ev = await calendar.events.list({ calendarId: 'primary', timeMin: now.toISOString(), timeMax: max.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 2500 })
        const mappings = await db.collection('google_events').find({ userId: auth.user.id }).toArray()
        const mappedIds = new Set(mappings.map(m => m.googleEventId))
        const external = []
        for (const e of ev.data.items || []) {
          if (!e) continue
          if (mappedIds.has(e.id) || e?.extendedProperties?.private?.book8BookingId) continue
          const start = e.start?.dateTime || e.start?.date
          const end = e.end?.dateTime || e.end?.date
          if (!start || !end) continue
          const conflict = book8.some(b => new Date(b.startTime) < new Date(end) && new Date(start) < new Date(b.endTime))
          external.push({
            id: `google:${e.id}`,
            userId: auth.user.id,
            title: e.summary || '(busy)',
            customerName: '',
            startTime: new Date(start).toISOString(),
            endTime: new Date(end).toISOString(),
            status: 'external',
            notes: e.description || '',
            source: 'google',
            conflict,
            htmlLink: e.htmlLink || null,
          })
        }
        // Also mark book8 conflicts if they overlap with any external
        const externalIntervals = external.map(x => ({ s: new Date(x.startTime).getTime(), e: new Date(x.endTime).getTime() }))
        book8 = book8.map(b => {
          const bs = new Date(b.startTime).getTime(); const be = new Date(b.endTime).getTime()
          const conflict = externalIntervals.some(x => bs < x.e && x.s < be)
          return { ...b, conflict }
        })
        const merged = [...book8, ...external]
        merged.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
        return json(merged)
      } catch { return json(book8) }
    }

    // Bookings create
    if (route === '/bookings' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const body = await getBody(request)
      const { title, customerName, startTime, endTime, notes } = body
      if (!title || !startTime || !endTime) return json({ error: 'title, startTime, endTime are required' }, { status: 400 })
      const s = new Date(startTime); const e = new Date(endTime)
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return json({ error: 'Invalid date format' }, { status: 400 })
      if (e <= s) return json({ error: 'endTime must be after startTime' }, { status: 400 })
      const booking = { id: uuidv4(), userId: auth.user.id, title, customerName: customerName || '', startTime: s.toISOString(), endTime: e.toISOString(), status: 'scheduled', notes: notes || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: 'book8', conflict: false }
      await db.collection('bookings').insertOne(booking)
      // Push to Google
      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          const res = await calendar.events.insert({ calendarId: 'primary', requestBody: buildGoogleEventFromBooking(booking) })
          await db.collection('google_events').updateOne({ userId: auth.user.id, bookingId: booking.id }, { $set: { userId: auth.user.id, bookingId: booking.id, googleEventId: res.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
        }
      } catch {}
      return json(booking)
    }

    // Bookings update
    if (route.startsWith('/bookings/') && (method === 'PUT' || method === 'PATCH')) {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const body = await getBody(request)
      const patch = {}
      if (body.title !== undefined) patch.title = body.title
      if (body.customerName !== undefined) patch.customerName = body.customerName
      if (body.startTime) { const d = new Date(body.startTime); if (isNaN(d.getTime())) return json({ error: 'Invalid startTime' }, { status: 400 }); patch.startTime = d.toISOString() }
      if (body.endTime) { const d = new Date(body.endTime); if (isNaN(d.getTime())) return json({ error: 'Invalid endTime' }, { status: 400 }); patch.endTime = d.toISOString() }
      if (patch.startTime && patch.endTime) { if (new Date(patch.endTime) <= new Date(patch.startTime)) return json({ error: 'endTime must be after startTime' }, { status: 400 }) }
      patch.updatedAt = new Date().toISOString()
      const res = await db.collection('bookings').findOneAndUpdate({ id, userId: auth.user.id }, { $set: patch }, { returnDocument: 'after' })
      if (!res.value) return json({ error: 'Booking not found' }, { status: 404 })
      const { _id, ...rest } = res.value
      // Update Google
      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          const mapping = await db.collection('google_events').findOne({ userId: auth.user.id, bookingId: id })
          if (mapping?.googleEventId) {
            await calendar.events.patch({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId, requestBody: buildGoogleEventFromBooking(rest) })
            await db.collection('google_events').updateOne({ userId: auth.user.id, bookingId: id }, { $set: { updatedAt: new Date() } })
          } else {
            const ins = await calendar.events.insert({ calendarId: 'primary', requestBody: buildGoogleEventFromBooking(rest) })
            await db.collection('google_events').updateOne({ userId: auth.user.id, bookingId: id }, { $set: { userId: auth.user.id, bookingId: id, googleEventId: ins.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
          }
        }
      } catch {}
      return json(rest)
    }

    // Bookings delete (cancel)
    if (route.startsWith('/bookings/') && method === 'DELETE') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const existing = await db.collection('bookings').findOne({ id, userId: auth.user.id })
      if (!existing) return json({ error: 'Booking not found' }, { status: 404 })
      await db.collection('bookings').updateOne({ id, userId: auth.user.id }, { $set: { status: 'canceled', updatedAt: new Date().toISOString() } })
      // Delete Google event if mapped
      try {
        const calendar = await getGoogleClientForUser(auth.user.id)
        if (calendar) {
          const mapping = await db.collection('google_events').findOne({ userId: auth.user.id, bookingId: id })
          if (mapping?.googleEventId) {
            try { await calendar.events.delete({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId }) } catch {}
            // Optionally remove mapping
            await db.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: id })
          }
        }
      } catch {}
      const updated = await db.collection('bookings').findOne({ id, userId: auth.user.id })
      const { _id, ...rest } = updated
      return json(rest)
    }

    // Google OAuth start
    if (route === '/integrations/google/auth' && method === 'GET') {
      const base = getBaseUrl(headers().get('host') || undefined)
      const urlObj = new URL(request.url)
      const jwtParam = urlObj.searchParams.get('jwt') || urlObj.searchParams.get('token')
      let userId = null
      if (jwtParam) { try { const payload = jwt.verify(jwtParam, getJwtSecret()); userId = payload.sub } catch {} }
      if (!userId) {
        const auth = await requireAuth(request, db)
        if (auth.error) return NextResponse.redirect(`${base}/?google_error=auth_required`)
        userId = auth.user.id
      }
      const oauth2Client = getOAuth2Client()
      if (!oauth2Client) return NextResponse.redirect(`${base}/?google_error=not_configured`)
      const state = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '10m' })
      const url = oauth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: getGoogleScopes(), state })
      return NextResponse.redirect(url)
    }

    // Google OAuth callback
    if (route === '/integrations/google/callback' && method === 'GET') {
      const urlObj = new URL(request.url)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const base = getBaseUrl(headers().get('host') || undefined)
      if (!code || !state) return NextResponse.redirect(`${base}/?google_error=missing_code_or_state`)
      let uid = null
      try { const payload = jwt.verify(state, getJwtSecret()); uid = payload.sub } catch { return NextResponse.redirect(`${base}/?google_error=invalid_state`) }
      const oauth2Client = getOAuth2Client(); if (!oauth2Client) return NextResponse.redirect(`${base}/?google_error=not_configured`)
      try {
        const { tokens } = await oauth2Client.getToken(code)
        const user = await db.collection('users').findOne({ id: uid })
        const prev = user?.google || {}
        const googleObj = { refreshToken: tokens.refresh_token || prev.refreshToken || null, scope: tokens.scope || prev.scope || getGoogleScopes().join(' '), connectedAt: prev.connectedAt || new Date().toISOString(), lastSyncedAt: prev.lastSyncedAt || null }
        await db.collection('users').updateOne({ id: uid }, { $set: { google: googleObj, updatedAt: new Date() } })
        return NextResponse.redirect(`${base}/?google_connected=1`)
      } catch { return NextResponse.redirect(`${base}/?google_error=token_exchange_failed`) }
    }

    // Cron: periodic push sync for all connected users
    if (route === '/cron/sync' && method === 'GET') {
      const urlObj = new URL(request.url)
      const secret = urlObj.searchParams.get('secret')
      const cronHeader = request.headers.get('x-vercel-cron')
      if (process.env.CRON_SECRET) {
        if (secret !== process.env.CRON_SECRET && !cronHeader) return json({ error: 'Unauthorized' }, { status: 401 })
      }
      const users = await db.collection('users').find({ 'google.refreshToken': { $exists: true, $ne: null } }).limit(50).toArray()
      let processed = 0
      for (const u of users) {
        try {
          const calendar = await getGoogleClientForUser(u.id)
          if (!calendar) continue
          const bookings = await db.collection('bookings').find({ userId: u.id, status: { $ne: 'canceled' } }).toArray()
          for (const b of bookings) {
            const mapping = await db.collection('google_events').findOne({ userId: u.id, bookingId: b.id })
            const evt = buildGoogleEventFromBooking(b)
            if (!mapping?.googleEventId) {
              const res = await calendar.events.insert({ calendarId: 'primary', requestBody: evt })
              await db.collection('google_events').updateOne(
                { userId: u.id, bookingId: b.id },
                { $set: { userId: u.id, bookingId: b.id, googleEventId: res.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true }
              )
            } else {
              await calendar.events.patch({ calendarId: 'primary', eventId: mapping.googleEventId, requestBody: evt })
              await db.collection('google_events').updateOne({ userId: u.id, bookingId: b.id }, { $set: { updatedAt: new Date() } })
            }
          }
          await db.collection('users').updateOne({ id: u.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
          processed++
        } catch (e) { }
      }
      return json({ ok: true, processed })
    }

    // Google Calendar - Sync bookings to Google (create/update/delete events)
    if (route === '/integrations/google/sync' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json({ error: 'Google not connected', reconnect: true }, { status: 400 })

      const allBookings = await db.collection('bookings').find({ userId: auth.user.id }).toArray()
      const active = allBookings.filter(b => b.status !== 'canceled')
      const canceled = allBookings.filter(b => b.status === 'canceled')

      let created = 0, updatedCount = 0, deleted = 0

      // Upsert active bookings
      for (const b of active) {
        const mapping = await db.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id })
        const evt = buildGoogleEventFromBooking(b)
        try {
          if (!mapping?.googleEventId) {
            const res = await calendar.events.insert({ calendarId: (mapping?.calendarId || 'primary'), requestBody: evt })
            await db.collection('google_events').updateOne(
              { userId: auth.user.id, bookingId: b.id },
              { $set: { userId: auth.user.id, bookingId: b.id, googleEventId: res.data.id, calendarId: 'primary', createdAt: new Date(), updatedAt: new Date() } },
              { upsert: true }
            )
            created++
          } else {
            await calendar.events.patch({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId, requestBody: evt })
            await db.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id }, { $set: { updatedAt: new Date() } })
            updatedCount++
          }
        } catch (e) { /* ignore item errors */ }
      }

      // Delete canceled bookings
      for (const b of canceled) {
        const mapping = await db.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id })
        if (!mapping?.googleEventId) continue
        try {
          await calendar.events.delete({ calendarId: mapping.calendarId || 'primary', eventId: mapping.googleEventId })
          await db.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id })
          deleted++
        } catch (e) {
          // If already gone (404/410), clean mapping
          try { await db.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id }) } catch {}
        }
      }

      await db.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
      return json({ ok: true, created, updated: updatedCount, deleted })
    }

    // ... existing Stripe and other routes remain unchanged ...

    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) { console.error('API Error:', error); return json({ error: 'Internal server error' }, { status: 500 }) }
}