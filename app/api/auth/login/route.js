import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { env } from '@/app/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function POST(req) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'email and password are required' }, { status: 400 })
    }

    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 })
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' })
    const googleSafe = user.google ? { connected: !!user.google?.refreshToken, lastSyncedAt: user.google?.lastSyncedAt || null } : { connected: false, lastSyncedAt: null }

    return NextResponse.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name || '', subscription: user.subscription || null, google: googleSafe }, redirect: '/dashboard' })
  } catch (err) {
    console.error('[auth/login] error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
