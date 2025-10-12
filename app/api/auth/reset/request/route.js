import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { headers } from 'next/headers'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'
import { signResetToken, ttlMinutes } from '@/app/lib/security/resetToken'

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
    try {
      // Token TTL index on expireAt
      await db.collection('password_reset_tokens').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 })
      await db.collection('password_reset_tokens').createIndex({ email: 1, nonce: 1, used: 1 }, { unique: true })
      // Rate limit TTL index
      await db.collection('password_reset_requests').createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 15 })
      await db.collection('password_reset_requests').createIndex({ email: 1, createdAt: -1 })
      await db.collection('password_reset_requests').createIndex({ ip: 1, createdAt: -1 })
    } catch {}
    indexesEnsured = true
  }
  return db
}

function getAppBase() {
  return process.env.APP_BASE_URL || `https://${headers().get('host')}`
}

function success() { return NextResponse.json({ ok: true, message: 'If an account exists, we emailed a link.' }) }

export async function POST(req) {
  const reqId = Math.random().toString(36).slice(2, 10)
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') return success()

    const database = await connectToMongo()
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'

    // Rate limit: 3 requests per 15 minutes per email+IP
    const windowAgo = new Date(Date.now() - 15 * 60 * 1000)
    const rlCount = await database.collection('password_reset_requests').countDocuments({ email: email.toLowerCase(), ip, createdAt: { $gte: windowAgo } })
    await database.collection('password_reset_requests').insertOne({ email: email.toLowerCase(), ip, createdAt: new Date() })
    if (rlCount >= 3) {
      console.warn(`[reset][${reqId}] rate-limited for ${email} from ${ip}`)
      return success()
    }

    const user = await database.collection('users').findOne({ email: String(email).toLowerCase() })
    if (!user) return success()

    const mins = ttlMinutes()
    const { token, payload } = signResetToken({ sub: user.id || user.email, ttlMinutes: mins, extra: { email: user.email } })

    // Store one-time marker (nonce + hash for defense in depth)
    const tokenHash = await bcrypt.hash(token, 10)
    await database.collection('password_reset_tokens').insertOne({
      email: user.email,
      userId: user.id || null,
      purpose: 'password_reset',
      nonce: payload.nonce,
      tokenHash,
      used: false,
      expireAt: new Date(payload.exp * 1000),
      createdAt: new Date(),
      ip
    })

    const resetLink = `${getAppBase()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`

    // Send email via Resend
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const html = `<div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="margin:0 0 16px">Reset your Book8 password</h1>
  <p>We received a request to reset your Book8 password. Click the button below to set a new one.</p>
  <p style="margin:24px 0">
    <a href="${resetLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px">Reset Password</a>
  </p>
  <p>Or copy and paste this link:</p>
  <p style="word-break:break-all"><a href="${resetLink}">${resetLink}</a></p>
  <hr style="margin:24px 0;border:0;border-top:1px solid #eee" />
  <p style="color:#555;font-size:12px">If you didn’t request this, you can ignore this email. This link expires in ${mins} minutes.</p>
  <p style="color:#555;font-size:12px">Need help? Reply to this email.</p>
</div>`
      const text = `Reset your Book8 password\n\nWe received a request to reset your Book8 password.\nReset link (expires in ${mins} minutes):\n${resetLink}\n\nIf you didn’t request this, you can ignore this email. Need help? Reply to this email.`
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: user.email,
        reply_to: process.env.EMAIL_REPLY_TO,
        subject: 'Reset your Book8 password',
        html,
        text,
      })
    } catch (e) {
      console.error(`[reset][${reqId}] email send failed`, e?.message || e)
    }

    return success()
  } catch (e) {
    console.error(`[reset][${reqId}] unexpected`, e)
    return success() // still generic response
  }
}
