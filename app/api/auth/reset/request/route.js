import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db
async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function baseUrl() {
  const h = headers().get('host') || ''
  const proto = h.includes('localhost') ? 'http' : 'https'
  return `${proto}://${h}`
}

export async function POST(req) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 })
    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json({ ok: true, message: 'If the email exists, a reset link has been generated.' })

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(token, 10)
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await database.collection('users').updateOne({ id: user.id }, { $set: { resetTokenHash: tokenHash, resetTokenExpires: expires } })

    const resetUrl = `${baseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`

    // In production, you should send an email via provider. For now, return link to caller for manual copy.
    return NextResponse.json({ ok: true, message: 'Reset link generated', resetUrl })
  } catch (e) {
    console.error('[auth/reset/request]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
