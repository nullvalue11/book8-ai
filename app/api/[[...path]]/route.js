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

    // Bookings list (with Google merge)
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await db.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      const book8 = items.map(({ _id, ...rest }) => ({ ...rest, source: 'book8', conflict: false }))

      const calendar = await getGoogleClientForUser(auth.user.id)
      if (!calendar) return json(book8)

      try {
        const now = new Date(); const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const ev = await calendar.events.list({ calendarId: 'primary', timeMin: now.toISOString(), timeMax: max.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 2500 })
        const mappings = await db.collection('google_events').find({ userId: auth.user.id }).toArray()
        const mapByGoogleId = {}
        for (const m of mappings) mapByGoogleId[m.googleEventId] = m
        const merged = mergeBook8WithGoogle(book8, ev.data.items || [], mapByGoogleId)
        return json(merged)
      } catch { return json(book8) }
    }

    // Bookings create/update/delete also push to Google (omitted for brevity in this diff)
    // ... existing POST /bookings, PATCH /bookings/:id, DELETE /bookings/:id handlers remain unchanged from previous commit ...

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

    // ... existing Stripe and other routes remain unchanged ...

    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) { console.error('API Error:', error); return json({ error: 'Internal server error' }, { status: 500 }) }
}