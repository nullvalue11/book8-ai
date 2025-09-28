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

// Stripe Idempotency Helpers
async function isStripeEventProcessed(database, eventId) {
  try {
    const existingEvent = await database.collection('stripe_events').findOne({ eventId })
    return !!existingEvent
  } catch (error) { console.error('Error checking event idempotency:', error); return false }
}
async function markStripeEventProcessed(database, eventId, eventType, eventData = {}) {
  try {
    await database.collection('stripe_events').insertOne({ eventId, eventType, eventData, processedAt: new Date(), createdAt: new Date() })
    return true
  } catch (error) { console.error('Error marking event as processed:', error); return false }
}
async function logBillingActivity(database, userId, eventType, eventId, details = {}, status = 'success') {
  try {
    await database.collection('billing_logs').insertOne({ id: uuidv4(), userId, eventType, eventId, details, status, timestamp: new Date(), createdAt: new Date() })
  } catch (error) { console.error('Error logging billing activity:', error) }
}
async function findUserByCustomerId(database, customerId) {
  try {
    const user = await database.collection('users').findOne({ 'subscription.customerId': customerId })
    return user?.id || null
  } catch (error) { console.error('Error finding user by customer ID:', error); return null }
}

// Google helpers (dynamic imports)
async function getOAuth2Client() {
  try {
    const { google } = await import('googleapis')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(headers().get('host') || undefined)}/api/integrations/google/callback`
    if (!clientId || !clientSecret) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (error) { console.error('Error loading Google OAuth client:', error); return null }
}
function getGoogleScopes() { return ['https://www.googleapis.com/auth/calendar'] }
async function getGoogleClientForUser(userId) {
  try {
    const { google } = await import('googleapis')
    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ id: userId })
    const refreshToken = user?.google?.refreshToken
    if (!refreshToken) return null
    const oauth2Client = await getOAuth2Client()
    if (!oauth2Client) return null
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    return google.calendar({ version: 'v3', auth: oauth2Client })
  } catch (error) { console.error('Error loading Google Calendar client:', error); return null }
}

// Stripe client (dynamic)
let stripe = null
async function getStripe() {
  if (!stripe) {
    try {
      const Stripe = (await import('stripe')).default
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) return null
      stripe = new Stripe(key)
    } catch (error) { console.error('Error loading Stripe:', error); return null }
  }
  return stripe
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

  console.log(`API Request: ${method} ${route}`)

  // Tavily fallbacks (ensure these never 404)
  if (route === '/search/_selftest' && method === 'GET') {
    const key = process.env.TAVILY_API_KEY || null
    return json({ ok: true, route: '/api/search/_selftest', tavilyKeyPresent: !!key, tavilyKeyLen: key ? key.length : 0, runtime: 'nodejs', timestamp: new Date().toISOString() })
  }
  if (route === '/search' && method === 'POST') {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) return json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 })
    const body = await getBody(request)
    const q = typeof body === 'string' ? body : body?.query
    if (!q) return json({ ok: false, error: 'Missing query' }, { status: 400 })
    try {
      const { TavilyClient } = await import('@tavily/core')
      const client = new TavilyClient({ apiKey })
      const res = await client.search({ query: q })
      return json({ ok: true, data: res })
    } catch (err) { return json({ ok: false, error: err?.message || 'search failed' }, { status: 500 }) }
  }
  if (route === '/search/booking-assistant' && method === 'POST') {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) return json({ ok: false, error: 'TAVILY_API_KEY missing' }, { status: 500 })
    const { prompt, context = {} } = await getBody(request)
    if (!prompt) return json({ ok: false, error: 'prompt is required' }, { status: 400 })
    try {
      const { TavilyClient } = await import('@tavily/core')
      const client = new TavilyClient({ apiKey })
      const enhanced = `Booking assistant task.\n${JSON.stringify(context)}\nUser prompt: ${prompt}`
      const res = await client.search({ query: enhanced })
      const answer = { summary: res?.answer ?? null, sources: res?.results?.map(r => ({ title: r.title, url: r.url })) ?? [] }
      return json({ ok: true, data: answer })
    } catch (err) { return json({ ok: false, error: err?.message || 'booking search failed' }, { status: 500 }) }
  }

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
      const safe = { id: u.id, email: u.email, name: u.name || '', subscription: u.subscription || null, google: { connected: !!u.google?.refreshToken, lastSyncedAt: u?.google?.lastSyncedAt || null } }
      return json(safe)
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

      // Safe Google push (primary)
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
          } catch (gerr) { console.error('Google push error', gerr?.message || gerr) }
        }
      } catch (outer) { console.error('Google client error', outer?.message || outer) }

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

    // Google Calendar endpoints
    if (route === '/integrations/google/calendars' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json({ error: 'Google not connected', reconnect: true }, { status: 400 })
      try {
        const response = await calendar.calendarList.list()
        const calendars = response.data.items?.map(cal => ({ id: cal.id, summary: cal.summary, description: cal.description || '', primary: cal.primary || false, accessRole: cal.accessRole, selected: false })) || []
        const user = await database.collection('users').findOne({ id: auth.user.id })
        const selectedCalendarIds = user?.google?.selectedCalendars || ['primary']
        calendars.forEach(cal => { cal.selected = selectedCalendarIds.includes(cal.id) || (cal.primary && selectedCalendarIds.includes('primary')) })
        return json({ calendars })
      } catch (error) { console.error('Failed to fetch Google Calendars:', error); return json({ error: 'Failed to fetch calendars' }, { status: 500 }) }
    }
    if (route === '/integrations/google/calendars' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json({ error: 'Google not connected', reconnect: true }, { status: 400 })
      const { selectedCalendars } = await getBody(request)
      if (!Array.isArray(selectedCalendars)) return json({ error: 'selectedCalendars must be an array' }, { status: 400 })
      try {
        await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.selectedCalendars': selectedCalendars, 'google.updatedAt': new Date() } })
        return json({ ok: true, selectedCalendars })
      } catch (error) { console.error('Failed to update calendar selections:', error); return json({ error: 'Failed to update calendar selections' }, { status: 500 }) }
    }

    // Google sync endpoints
    if (route === '/integrations/google/sync' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json({ error: 'Google not connected', reconnect: true }, { status: 400 })
      const user = await database.collection('users').findOne({ id: auth.user.id })
      const selectedCalendars = user?.google?.selectedCalendars || ['primary']
      const allBookings = await database.collection('bookings').find({ userId: auth.user.id }).toArray()
      const active = allBookings.filter(b => b.status !== 'canceled')
      const canceled = allBookings.filter(b => b.status === 'canceled')
      let created = 0, updatedCount = 0, deleted = 0
      for (const b of active) {
        for (const calendarId of selectedCalendars) {
          const map = await database.collection('google_events').findOne({ userId: auth.user.id, bookingId: b.id, calendarId })
          const evt = buildGoogleEventFromBooking(b)
          try {
            if (!map?.googleEventId) {
              const ins = await calendar.events.insert({ calendarId, requestBody: evt })
              await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id, calendarId }, { $set: { userId: auth.user.id, bookingId: b.id, googleEventId: ins.data.id, calendarId, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true })
              created++
            } else {
              await calendar.events.patch({ calendarId, eventId: map.googleEventId, requestBody: evt })
              await database.collection('google_events').updateOne({ userId: auth.user.id, bookingId: b.id, calendarId }, { $set: { updatedAt: new Date() } })
              updatedCount++
            }
          } catch (err) { console.error(`Failed to sync booking ${b.id} to calendar ${calendarId}:`, err) }
        }
      }
      for (const b of canceled) {
        const maps = await database.collection('google_events').find({ userId: auth.user.id, bookingId: b.id }).toArray()
        for (const map of maps) {
          if (!map?.googleEventId) continue
          try { await calendar.events.delete({ calendarId: map.calendarId || 'primary', eventId: map.googleEventId }); await database.collection('google_events').deleteOne({ userId: auth.user.id, bookingId: b.id, calendarId: map.calendarId }); deleted++ } catch (err) { console.error(`Failed to delete event ${map.googleEventId} from calendar ${map.calendarId}:`, err) }
        }
      }
      await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.lastSyncedAt': new Date().toISOString() } })
      return json({ ok: true, created, updated: updatedCount, deleted, calendarsSelected: selectedCalendars.length })
    }
    if (route === '/integrations/google/sync' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const u = await database.collection('users').findOne({ id: auth.user.id })
      return json({ connected: !!u?.google?.refreshToken, lastSyncedAt: u?.google?.lastSyncedAt || null })
    }

    // Billing portal
    if (route === '/billing/portal' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const s = await getStripe(); if (!s) return json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, { status: 400 })
      const user = await database.collection('users').findOne({ id: auth.user.id })
      const customerId = user?.subscription?.customerId
      if (!customerId) return json({ error: 'No subscription found' }, { status: 400 })
      const base = getBaseUrl(headers().get('host') || undefined)
      try { const session = await s.billingPortal.sessions.create({ customer: customerId, return_url: `${base}/?portal_return=true` }); return json({ url: session.url }) } catch { return json({ error: 'Failed to create portal session' }, { status: 500 }) }
    }

    // Stripe Webhook with Idempotency
    if (route === '/billing/stripe/webhook' && method === 'POST') {
      const s = await getStripe(); if (!s) return json({ error: 'Stripe not configured' }, { status: 400 })
      let event
      try {
        const body = await request.text()
        const sig = request.headers.get('stripe-signature')
        if (!sig) return json({ error: 'Missing signature' }, { status: 400 })
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
        if (!webhookSecret) return json({ error: 'Webhook secret not configured' }, { status: 400 })
        event = s.webhooks.constructEvent(body, sig, webhookSecret)
      } catch (err) { console.error('Webhook signature verification failed:', err.message); return json({ error: 'Invalid signature' }, { status: 400 }) }

      const isAlreadyProcessed = await isStripeEventProcessed(database, event.id)
      if (isAlreadyProcessed) return json({ received: true, alreadyProcessed: true })
      try {
        switch (event.type) {
          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object
            const userId = await findUserByCustomerId(database, subscription.customer)
            if (userId) {
              await database.collection('users').updateOne(
                { id: userId },
                { $set: { 'subscription.status': subscription.status, 'subscription.priceId': subscription.items.data[0]?.price?.id || null, 'subscription.customerId': subscription.customer, 'subscription.subscriptionId': subscription.id, 'subscription.currentPeriodStart': new Date(subscription.current_period_start * 1000).toISOString(), 'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000).toISOString(), 'subscription.updatedAt': new Date().toISOString() } }
              )
              await logBillingActivity(database, userId, event.type, event.id, { subscriptionId: subscription.id, status: subscription.status, priceId: subscription.items.data[0]?.price?.id })
            }
            break
          }
          case 'customer.subscription.deleted': {
            const deletedSub = event.data.object
            const userIdDeleted = await findUserByCustomerId(database, deletedSub.customer)
            if (userIdDeleted) {
              await database.collection('users').updateOne(
                { id: userIdDeleted },
                { $set: { 'subscription.status': 'canceled', 'subscription.updatedAt': new Date().toISOString() } }
              )
              await logBillingActivity(database, userIdDeleted, event.type, event.id, { subscriptionId: deletedSub.id, status: 'canceled' })
            }
            break
          }
          case 'invoice.payment_succeeded': {
            const invoice = event.data.object
            const userIdInvoice = await findUserByCustomerId(database, invoice.customer)
            if (userIdInvoice) {
              await logBillingActivity(database, userIdInvoice, event.type, event.id, { invoiceId: invoice.id, amountPaid: invoice.amount_paid, currency: invoice.currency })
            }
            break
          }
          case 'invoice.payment_failed': {
            const failedInvoice = event.data.object
            const userIdFailed = await findUserByCustomerId(database, failedInvoice.customer)
            if (userIdFailed) {
              await logBillingActivity(database, userIdFailed, event.type, event.id, { invoiceId: failedInvoice.id, amountDue: failedInvoice.amount_due, currency: failedInvoice.currency }, 'failed')
            }
            break
          }
          default:
            console.log(`Unhandled event type: ${event.type}`)
            await logBillingActivity(database, null, event.type, event.id, { unhandled: true })
        }
        await markStripeEventProcessed(database, event.id, event.type, { customerId: event.data.object.customer || null, amount: event.data.object.amount || event.data.object.amount_paid || null })
        return json({ received: true, processed: true })
      } catch (error) { console.error('Error processing webhook:', error); await logBillingActivity(database, null, event.type, event.id, { error: error.message }, 'error'); return json({ error: 'Processing failed' }, { status: 500 }) }
    }

    // Billing Activity Log
    if (route === '/billing/logs' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      try {
        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '50')
        const skip = parseInt(url.searchParams.get('skip') || '0')
        const logs = await database.collection('billing_logs').find({ userId: auth.user.id }).sort({ timestamp: -1 }).limit(Math.min(limit, 100)).skip(skip).toArray()
        const cleaned = logs.map(({ _id, ...rest }) => rest)
        return json({ logs: cleaned, count: cleaned.length })
      } catch (error) { console.error('Error fetching billing logs:', error); return json({ error: 'Failed to fetch billing logs' }, { status: 500 }) }
    }

    // Stripe Events Status
    if (route === '/billing/events/status' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      try {
        const url = new URL(request.url)
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const events = await database.collection('stripe_events').find({}).sort({ processedAt: -1 }).limit(Math.min(limit, 50)).toArray()
        const cleaned = events.map(({ _id, ...rest }) => rest)
        return json({ events: cleaned, count: cleaned.length })
      } catch (error) { console.error('Error fetching stripe events:', error); return json({ error: 'Failed to fetch stripe events' }, { status: 500 }) }
    }

    // Fallback
    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) {
    console.error('API Error (outer):', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}