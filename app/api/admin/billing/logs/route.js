import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'

// Ensure this API route is always dynamic and never statically optimized
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const runtime = 'nodejs'

let client
let db

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function getJwtSecret() { return env.JWT_SECRET || 'dev-secret-change-me' }

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const jwt = (await import('jsonwebtoken')).default
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

function isAdmin(user) {
  const allow = ('' || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return allow.includes(String(user?.email || '').toLowerCase())
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    if (!isAdmin(auth.user)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

    const url = new URL(request.url)
    const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200)
    const skip = (page - 1) * limit

    const query = {}
    const customerId = url.searchParams.get('customerId')
    const plan = url.searchParams.get('plan')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (customerId) query.customerId = customerId
    if (plan) query.plan = plan
    if (from || to) {
      query.createdAt = {}
      if (from) query.createdAt.$gte = new Date(from)
      if (to) query.createdAt.$lte = new Date(to)
    }

    const [items, total] = await Promise.all([
      database.collection('billing_logs').find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      database.collection('billing_logs').countDocuments(query)
    ])

    const cleaned = items.map(({ _id, ...rest }) => rest)
    return NextResponse.json({ ok: true, logs: cleaned, page, limit, total })
  } catch (e) {
    console.error('[admin/billing/logs] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
