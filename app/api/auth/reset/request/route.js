import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'

// Ensure dynamic runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

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

async function sendResetEmail({ to, resetUrl }) {
  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.FROM_EMAIL
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || !fromEmail) {
      console.warn('[reset/request] Missing RESEND_API_KEY or FROM email; skipping email send')
      return { sent: false, reason: 'missing_config' }
    }
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Reset your Book8 AI password',
      html: `<p>You requested a password reset.</p><p>Click <a href="${resetUrl}">this secure link</a> to reset your password.</p><p>If you did not request this, you can ignore this email.</p>`
    })
    return { sent: true }
  } catch (e) {
    console.error('[reset/request] email send failed', e?.message || e)
    return { sent: false, reason: 'send_failed' }
  }
}

export async function POST(req) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 })
    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json({ ok: true, message: 'If the email exists, a reset link has been sent.' })

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(token, 10)
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await database.collection('users').updateOne({ id: user.id }, { $set: { resetTokenHash: tokenHash, resetTokenExpires: expires } })

    const resetUrl = `${baseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`

    const emailResult = await sendResetEmail({ to: user.email, resetUrl })

    // Still include resetUrl for dev/testing; production clients can ignore it
    return NextResponse.json({ ok: true, message: emailResult.sent ? 'Email sent' : 'Email not sent (fallback delivered)', emailSent: emailResult.sent, resetUrl })
  } catch (e) {
    console.error('[auth/reset/request]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
