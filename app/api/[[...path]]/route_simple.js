import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

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
    } catch {}
    indexesEnsured = true
  }
  return db
}

// Helpers
function cors(resp) {
  resp.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization')
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
      try { 
        await database.command({ ping: 1 })
        return json({ ok: true, message: 'Book8 API online' }) 
      } catch { 
        return json({ ok: false }, { status: 500 }) 
      }
    }

    // Auth
    if (route === '/auth/register' && method === 'POST') {
      const { email, password, name } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const hashed = await bcrypt.hash(password, 10)
      const user = { 
        id: uuidv4(), 
        email: String(email).toLowerCase(), 
        name: name || '', 
        passwordHash: hashed, 
        createdAt: new Date(), 
        subscription: null 
      }
      try { 
        await database.collection('users').insertOne(user) 
      } catch (e) { 
        if (String(e?.message || '').includes('duplicate')) {
          return json({ error: 'Email already registered' }, { status: 409 })
        }
        throw e 
      }
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          subscription: user.subscription 
        } 
      })
    }

    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await getBody(request)
      if (!email || !password) return json({ error: 'email and password are required' }, { status: 400 })
      const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
      if (!user) return json({ error: 'Invalid credentials' }, { status: 401 })
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return json({ error: 'Invalid credentials' }, { status: 401 })
      const token = jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' })
      return json({ 
        token, 
        user: { 
          id: user.id, 
          email: user.email, 
          name: user.name || '', 
          subscription: user.subscription || null 
        } 
      })
    }

    // Bookings list
    if (route === '/bookings' && method === 'GET') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })
      const items = await database.collection('bookings').find({ userId: auth.user.id }).sort({ startTime: 1 }).toArray()
      const cleaned = items.map(({ _id, ...rest }) => rest)
      return json(cleaned)
    }

    // Bookings create - SIMPLIFIED VERSION
    if (route === '/bookings' && method === 'POST') {
      const auth = await requireAuth(request, database)
      if (auth.error) return json({ error: auth.error }, { status: auth.status })

      console.log('POST /bookings - Starting booking creation')

      const body = await getBody(request)
      const { title, customerName, startTime, endTime, notes, timeZone } = body || {}
      
      console.log('POST /bookings body:', { title, customerName, startTime, endTime, timeZone })

      if (!title || !startTime || !endTime) {
        return json({ error: 'title, startTime, endTime are required' }, { status: 400 })
      }
      
      const s = new Date(startTime)
      const e = new Date(endTime)
      if (isNaN(s.getTime()) || isNaN(e.getTime())) {
        return json({ error: 'Invalid date format' }, { status: 400 })
      }
      if (e <= s) {
        return json({ error: 'endTime must be after startTime' }, { status: 400 })
      }

      const booking = {
        id: uuidv4(), 
        userId: auth.user.id, 
        title,
        customerName: customerName || '', 
        startTime: s.toISOString(), 
        endTime: e.toISOString(),
        status: 'scheduled', 
        notes: notes || '', 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(),
        source: 'book8', 
        conflict: false, 
        timeZone: timeZone || 'UTC',
      }

      console.log('POST /bookings - About to insert booking:', booking)

      try { 
        await database.collection('bookings').insertOne(booking)
        console.log('POST /bookings - Booking inserted successfully')
      } catch (e) {
        console.error('DB insert booking error', e)
        return json({ error: 'Failed to save booking' }, { status: 500 })
      }

      return json(booking)
    }

    return json({ error: `Route ${route} not found` }, { status: 404 })
  } catch (error) {
    console.error('API Error (outer):', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}