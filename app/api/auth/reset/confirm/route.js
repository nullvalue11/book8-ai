import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

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

export async function POST(req) {
  try {
    const { email, token, newPassword } = await req.json()
    if (!email || !token || !newPassword) return NextResponse.json({ ok: false, error: 'email, token, newPassword required' }, { status: 400 })
    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
    if (!user?.resetTokenHash || !user?.resetTokenExpires) return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 })
    if (new Date(user.resetTokenExpires).getTime() < Date.now()) return NextResponse.json({ ok: false, error: 'Token expired' }, { status: 400 })

    const match = await bcrypt.compare(String(token), String(user.resetTokenHash))
    if (!match) return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 })

    const passwordHash = await bcrypt.hash(String(newPassword), 10)
    await database.collection('users').updateOne(
      { id: user.id },
      { $set: { passwordHash }, $unset: { resetTokenHash: '', resetTokenExpires: '' } }
    )

    return NextResponse.json({ ok: true, message: 'Password updated' })
  } catch (e) {
    console.error('[auth/reset/confirm]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
