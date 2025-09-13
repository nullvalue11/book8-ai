import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import Stripe from 'stripe'

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
    } catch (e) {
      // ignore index errors
    }
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

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

const json = (data, init = {}) => handleCORS(NextResponse.json(data, init))

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me'
}

async function getBody(request) {
  try {
    return await request.json()
  } catch {
    return {}
  }
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
  } catch (e) {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

// Validators
function isISODateString(s) {
  if (typeof s !== 'string') return false
  const d = new Date(s)
  return !isNaN(d.getTime())
}

// Price mapping
function getPriceId(plan) {
  const map = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  }
  return map[plan]
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
    const db = await connectToMongo()

    // Health checks
    if ((route === '/health' || route === '/root' || route === '/') && method === 'GET') {
      try {
        await db.command({ ping: 1 })
        return json({ ok: true, message: 'Book8 API online' })
      } catch {
        return json({ ok: false }, { status: 500 })
      }
    }

    // Status sample endpoints kept
    if (route === '/status' && method === 'POST') {
      const body = await getBody(request)
      if (!body.client_name) return json({ error: 'client_name is required' }, { status: 400 })
      const statusObj = { id: uuidv4(), client_name: body.client_name, timestamp: new Date() }
      await db.collection('status_checks').insertOne(statusObj)
      return json(statusObj)
    }
    if (route === '/status' && method === 'GET') {
      const statusChecks = await db.collection('status_checks').find({}).limit(1000).toArray()
      const cleaned = statusChecks.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Auth
    if (route === '/auth/register' && method === 'POST') {
      const body = await getBody(request)
      const { email, password, name } = body
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const hashed = await bcrypt.hash(password, 10)
      const user = { id: uuidv4(), email: String(email).toLowerCase(), name: name || '', passwordHash: hashed, createdAt: new Date(), subscription: null }
      try {
        await db.collection('users').insertOne(user)
      } catch (e) {
        if (String(e?.message || '').includes('duplicate')) return json({ error: 'Email already registered' }, { status: 409 })
        throw e
      }
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ token, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription } })
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await getBody(request)
      const { email, password } = body
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const user = await db.collection('users').findOne({ email: String(email).toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return json({ error: 'Invalid credentials' }, { status: 401 })
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ token, user: { id: user.id, email: user.email, name: user.name || '', subscription: user.subscription || null } })
    }

    // Current user profile
    if (route === '/user' && method === 'GET') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const u = await db.collection('users').findOne({ id: auth.user.id })
      if (!u) return json({ error: 'User not found' }, { status: 404 })
      const { _id, passwordHash, ...safe } = u
      return json(safe)
    }

    // Bookings CRUD
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await db.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    if (route === '/bookings' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const body = await getBody(request)
      const { title, customerName, startTime, endTime, notes } = body
      if (!title || !startTime || !endTime) return json({ error: 'title, startTime, endTime are required' }, { status: 400 })
      if (!isISODateString(startTime) || !isISODateString(endTime)) return json({ error: 'Invalid date format' }, { status: 400 })
      if (new Date(endTime) <= new Date(startTime)) return json({ error: 'endTime must be after startTime' }, { status: 400 })
      const booking = {
        id: uuidv4(),
        userId: auth.user.id,
        title,
        customerName: customerName || '',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        status: 'scheduled',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await db.collection('bookings').insertOne(booking)
      return json(booking)
    }

    if (route.startsWith('/bookings/') && (method === 'PUT' || method === 'PATCH')) {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const body = await getBody(request)
      const patch = {}
      if (body.title !== undefined) patch.title = body.title
      if (body.customerName !== undefined) patch.customerName = body.customerName
      if (body.startTime) {
        if (!isISODateString(body.startTime)) return json({ error: 'Invalid startTime' }, { status: 400 })
        patch.startTime = new Date(body.startTime).toISOString()
      }
      if (body.endTime) {
        if (!isISODateString(body.endTime)) return json({ error: 'Invalid endTime' }, { status: 400 })
        patch.endTime = new Date(body.endTime).toISOString()
      }
      if (patch.startTime && patch.endTime) {
        if (new Date(patch.endTime) <= new Date(patch.startTime)) return json({ error: 'endTime must be after startTime' }, { status: 400 })
      }
      patch.updatedAt = new Date().toISOString()
      const res = await db.collection('bookings').findOneAndUpdate(
        { id, userId: auth.user.id },
        { $set: patch },
        { returnDocument: 'after' }
      )
      if (!res.value) return json({ error: 'Booking not found' }, { status: 404 })
      const { _id, ...rest } = res.value
      return json(rest)
    }

    if (route.startsWith('/bookings/') && method === 'DELETE') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const id = route.split('/')[2]
      const existingBooking = await db.collection('bookings').findOne({ id, userId: auth.user.id })
      if (!existingBooking) return json({ error: 'Booking not found' }, { status: 404 })
      await db.collection('bookings').updateOne(
        { id, userId: auth.user.id },
        { $set: { status: 'canceled', updatedAt: new Date().toISOString() } }
      )
      const updated = await db.collection('bookings').findOne({ id, userId: auth.user.id })
      const { _id, ...rest } = updated
      return json(rest)
    }

    // Integrations - Stubs remaining for MVP

    // Google Calendar sync stub
    if (route === '/integrations/google/sync' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      return json({ ok: true, message: 'Google Calendar sync stubbed. Provide OAuth creds to enable.', synced: 0 })
    }

    // OpenAI Realtime Audio stub
    if (route === '/integrations/voice/call' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      return json({ ok: true, message: 'OpenAI Realtime Audio stubbed. Provide key to enable.' })
    }

    // Tavily search stub
    if (route === '/integrations/search' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const body = await getBody(request)
      return json({ ok: true, query: body?.q || '', results: [], note: 'Tavily stubbed. Provide API key to enable.' })
    }

    // -------------------- Stripe Billing --------------------

    // Create Checkout Session
    if (route === '/billing/checkout' && method === 'POST') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const s = getStripe()
      if (!s) return json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, { status: 400 })
      const body = await getBody(request)
      const planRaw = (body?.plan || '').toString().toLowerCase()
      const priceId = getPriceId(planRaw)
      if (!priceId) return json({ error: 'Invalid plan. Use starter|growth|enterprise' }, { status: 400 })
      const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/account?success=true&session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}`
      try {
        const session = await s.checkout.sessions.create({
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { userId: auth.user.id },
        })
        return json({ url: session.url })
      } catch (e) {
        console.error('Stripe checkout error', e)
        return json({ error: 'Failed to create checkout session' }, { status: 500 })
      }
    }

    // Create Customer Portal Session
    if (route === '/billing/portal' && method === 'GET') {
      const auth = await requireAuth(request, db)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const s = getStripe()
      if (!s) return json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY.' }, { status: 400 })
      const user = await db.collection('users').findOne({ id: auth.user.id })
      const customerId = user?.subscription?.customerId
      if (!customerId) return json({ error: 'No subscription found' }, { status: 400 })
      try {
        const session = await s.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account`,
        })
        return json({ url: session.url })
      } catch (e) {
        console.error('Stripe portal error', e)
        return json({ error: 'Failed to create portal session' }, { status: 500 })
      }
    }

    // Stripe webhook (replace stub)
    if (route === '/billing/stripe/webhook' && method === 'POST') {
      const s = getStripe()
      if (!s) return handleCORS(new NextResponse('Stripe not configured', { status: 400 }))
      const sig = request.headers.get('stripe-signature')
      if (!sig) return handleCORS(new NextResponse('Missing signature', { status: 400 }))
      const rawBody = await request.text() // raw string for signature verification
      let event
      try {
        event = s.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
      } catch (err) {
        console.error('Webhook signature verification failed', err?.message)
        return handleCORS(new NextResponse(`Webhook Error: ${err.message}`, { status: 400 }))
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object
            const subscriptionId = session.subscription
            const customerId = session.customer
            // fetch subscription details
            const sub = await s.subscriptions.retrieve(subscriptionId)
            await db.collection('users').updateOne(
              { id: session.metadata?.userId },
              {
                $set: {
                  subscription: {
                    subscriptionId: sub.id,
                    customerId,
                    priceId: sub?.items?.data?.[0]?.price?.id || null,
                    status: sub.status,
                    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                  },
                  updatedAt: new Date(),
                },
              }
            )
            break
          }
          case 'customer.subscription.updated':
          case 'invoice.payment_succeeded': {
            const obj = event.data.object
            const subscriptionId = obj.subscription || obj.id
            const customerId = obj.customer
            const sub = await s.subscriptions.retrieve(subscriptionId)
            await db.collection('users').updateOne(
              { 'subscription.customerId': customerId },
              {
                $set: {
                  subscription: {
                    subscriptionId: sub.id,
                    customerId,
                    priceId: sub?.items?.data?.[0]?.price?.id || null,
                    status: sub.status,
                    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
                  },
                  updatedAt: new Date(),
                },
              }
            )
            break
          }
          case 'customer.subscription.deleted': {
            const sub = event.data.object
            await db.collection('users').updateOne(
              { 'subscription.customerId': sub.customer },
              { $set: { 'subscription.status': 'canceled', updatedAt: new Date() } }
            )
            break
          }
          default:
            // no-op
            break
        }
      } catch (err) {
        console.error('Webhook handler error', err)
        return handleCORS(new NextResponse('Webhook handler error', { status: 500 }))
      }

      return handleCORS(new NextResponse('OK', { status: 200 }))
    }

    // Unknown route
    return json({ error: `Route ${route} not found` }, { status: 404 })

  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}