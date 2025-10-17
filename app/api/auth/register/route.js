import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
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
    const { email, password, name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'email and password are required' }, { status: 400 })
    }

    const database = await connectToMongo()

    const hashed = await bcrypt.hash(password, 10)
    const user = { id: uuidv4(), email: String(email).toLowerCase(), name: name || '', passwordHash: hashed, createdAt: new Date(), subscription: null, google: null }
    try {
      await database.collection('users').insertOne(user)
    } catch (e) {
      if (String(e?.message || '').includes('duplicate')) {
        return NextResponse.json({ ok: false, error: 'Email already registered' }, { status: 409 })
      }
      throw e
    }
    const token = jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, { expiresIn: '7d' })
    return NextResponse.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, subscription: user.subscription, google: { connected: false, lastSyncedAt: null } } })
  } catch (err) {
    console.error('[auth/register] error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
