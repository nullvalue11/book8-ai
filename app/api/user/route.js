import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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

export async function OPTIONS() { return new Response(null, { status: 204 }) }

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    let payload
    try { payload = jwt.verify(token, env.JWT_SECRET) } catch { return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
    const u = await database.collection('users').findOne({ id: payload.sub })
    if (!u) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    const safe = { id: u.id, email: u.email, name: u.name || '', subscription: u.subscription || null, google: { connected: !!(u.google?.refreshToken || u.google?.connected), lastSyncedAt: u.google?.lastSyncedAt || null, selectedCalendarIds: u.google?.selectedCalendarIds || [] }, scheduling: u.scheduling ? { handle: u.scheduling.handle || null, timeZone: u.scheduling.timeZone || 'UTC', selectedCalendarIds: u.scheduling.selectedCalendarIds || [] } : null }
    return NextResponse.json(safe)
  } catch (e) {
    console.error('[user] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
