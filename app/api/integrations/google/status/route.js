import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function getJwtSecret() {
  return env.JWT_SECRET
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    if (!isSubscribed(auth.user)) {
      return NextResponse.json(
        { ok: false, error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED', feature: 'calendar' },
        { status: 402 }
      )
    }

    const u = await database.collection('users').findOne({ id: auth.user.id })
    const connected = !!(u?.google?.refreshToken || u?.google?.connected)

    return NextResponse.json({
      ok: true,
      connected,
      lastSyncedAt: u?.google?.lastSyncedAt || null
    })
  } catch (e) {
    console.error('[google/status] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

