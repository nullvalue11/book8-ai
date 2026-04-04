/**
 * GET /api/billing/portal
 * BOO-52 / BOO-53: Stripe Customer Portal — URL always from Stripe API (never hardcoded).
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripeSubscription'
import { ensureStripeCustomerForUser } from '@/lib/stripeCustomerRecovery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return { error: 'Missing Authorization header', status: 401 }
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function GET(request) {
  try {
    const stripe = await getStripe()
    if (!stripe) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 503 })
    }

    const database = await connect()
    const auth = await requireAuth(request, database)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const usersCol = database.collection('users')
    const customerId = await ensureStripeCustomerForUser(stripe, {
      user: auth.user,
      usersCollection: usersCol
    })

    const base = String(env.BASE_URL || 'https://www.book8.io').replace(/\/$/, '')
    const returnUrl = `${base}/dashboard/settings/billing?portal_return=true`

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    })

    if (!session?.url) {
      return NextResponse.json({ ok: false, error: 'Could not create billing portal session' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, url: session.url })
  } catch (e) {
    console.error('[billing/portal]', e)
    return NextResponse.json(
      { ok: false, error: e?.message || 'Portal failed' },
      { status: 500 }
    )
  }
}
