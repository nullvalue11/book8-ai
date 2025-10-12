import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { verifyResetToken } from '@/app/lib/security/resetToken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client
let db
let indexesEnsured = false
async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!indexesEnsured) {
    try { await db.collection('password_reset_tokens').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }) } catch {}
    indexesEnsured = true
  }
  return db
}

const ConfirmSchema = z.object({ token: z.string().min(10), newPassword: z.string().min(8).max(128) })

export async function POST(req) {
  const reqId = Math.random().toString(36).slice(2, 10)
  try {
    const body = await req.json()
    const { token, newPassword } = ConfirmSchema.parse(body)
    const { valid, payload, error } = verifyResetToken(token)
    if (!valid) return NextResponse.json({ ok: false, code: 'INVALID_TOKEN', error: error?.message || 'Invalid token' }, { status: 400 })

    const database = await connectToMongo()

    // Lookup marker by nonce + email (from JWT payload or body)
    const email = payload.email || null
    if (!email) return NextResponse.json({ ok: false, code: 'INVALID_TOKEN', error: 'Missing email in token' }, { status: 400 })

    const marker = await database.collection('password_reset_tokens').findOne({ email, nonce: payload.nonce })
    if (!marker) return NextResponse.json({ ok: false, code: 'TOKEN_NOT_FOUND', error: 'Token not found' }, { status: 400 })
    if (marker.used) return NextResponse.json({ ok: false, code: 'TOKEN_USED', error: 'Token already used' }, { status: 400 })
    if (new Date(marker.expireAt).getTime() < Date.now()) return NextResponse.json({ ok: false, code: 'TOKEN_EXPIRED', error: 'Token expired' }, { status: 400 })

    const hash = await bcrypt.hash(String(newPassword), 10)
    await database.collection('users').updateOne({ email: email.toLowerCase() }, { $set: { passwordHash: hash, updatedAt: new Date() } })

    await database.collection('password_reset_tokens').updateOne({ _id: marker._id }, { $set: { used: true, usedAt: new Date() } })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(`[reset][confirm]`, e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
