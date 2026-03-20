import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function getJwtSecret() {
  return env.JWT_SECRET || 'dev-secret-change-me'
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { payload, user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function GET(request) {
  try {
    const database = await connect()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    const ms = auth.user?.microsoft || {}
    const connected = !!(ms?.refreshToken && ms?.connected === true)

    return NextResponse.json({
      ok: true,
      connected,
      lastSyncedAt: ms?.lastSyncedAt || ms?.connectedAt || null
    })
  } catch (e) {
    console.error('[microsoft/status] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

