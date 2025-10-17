import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/app/lib/env'

// Ensure this API route is always dynamic and never statically optimized
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

let client
let db
let indexesEnsured = false

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  if (!indexesEnsured) {
    try { await db.collection('billing_logs').createIndex({ eventId: 1 }, { unique: true }) } catch {}
    indexesEnsured = true
  }
  return db
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const jwt = (await import('jsonwebtoken')).default
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    // map user to customerId
    const user = await database.collection('users').findOne({ id: auth.user.id })
    const customerId = user?.subscription?.customerId || null
    if (!customerId) return NextResponse.json({ ok: true, logs: [], page: 1, limit: 20, total: 0 })

    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20'), 1), 100)
    const skip = (page - 1) * limit

    const query = { customerId }

    const [items, total] = await Promise.all([
      database.collection('billing_logs').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      database.collection('billing_logs').countDocuments(query)
    ])

    const cleaned = items.map(({ _id, ...rest }) => rest)
    return NextResponse.json({ ok: true, logs: cleaned, page, limit, total })
  } catch (e) {
    console.error('[billing/logs] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
