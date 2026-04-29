/**
 * POST /api/billing/restore
 *
 * BOO-CANCEL-1B — restore a Path B (cancel-at-period-end) subscription.
 *
 * Body: { businessId: string }
 *
 * Auth: Bearer JWT (matches other /api/business and /api/billing routes).
 *
 * Validates: subscription.cancelAtPeriodEnd === true AND now < currentPeriodEnd.
 * Otherwise returns 410 cannot_restore.
 *
 * Then: stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false }),
 * clears Mongo cancellation fields, sends restoration email, audit log.
 */

import { NextResponse } from 'next/server'
import { MongoClient, type Db } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripeSubscription'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import { sendSubscriptionRestoredEmail } from '@/lib/cancellationEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

async function connectToDatabase(): Promise<Db> {
  if (cachedDb) return cachedDb
  if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
  if (!env.DB_NAME) throw new Error('DB_NAME missing')
  const client = await MongoClient.connect(env.MONGO_URL)
  cachedClient = client
  cachedDb = client.db(env.DB_NAME)
  return cachedDb
}

interface AuthResult {
  userId?: string
  error?: string
  status?: number
}

function authenticate(request: Request): AuthResult {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return { error: 'Authentication required', status: 401 }
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string }
    if (!payload?.sub) {
      return { error: 'Invalid token payload', status: 401 }
    }
    return { userId: payload.sub }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

async function writeAuditLog(db: Db, entry: any): Promise<void> {
  try {
    await db.collection('billing_audit_logs').insertOne(entry)
  } catch (e) {
    console.error('[billing/restore] audit log insert failed', (e as Error)?.message)
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(request: Request) {
  const auth = authenticate(request)
  if (auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 })
  }
  const userId = auth.userId as string

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessId: string | undefined = body?.businessId
  if (!businessId || typeof businessId !== 'string') {
    return NextResponse.json({ ok: false, error: 'businessId is required' }, { status: 400 })
  }

  const stripe = await getStripe()
  if (!stripe) {
    return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 503 })
  }

  let db: Db
  try {
    db = await connectToDatabase()
  } catch (e) {
    console.error('[billing/restore] db connect failed', e)
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 500 })
  }

  const businessesCol = db.collection(COLLECTION_NAME)
  const business = await businessesCol.findOne({
    $or: [{ businessId }, { id: businessId }]
  })
  if (!business) {
    return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
  }
  if (business.ownerUserId !== userId) {
    return NextResponse.json(
      { ok: false, error: 'Access denied — not business owner' },
      { status: 403 }
    )
  }

  const sub = business.subscription || {}
  const stripeSubscriptionId: string | null = sub.stripeSubscriptionId || null

  if (!stripeSubscriptionId) {
    return NextResponse.json(
      { ok: false, error: 'No Stripe subscription on this business' },
      { status: 400 }
    )
  }

  if (sub.cancelAtPeriodEnd !== true) {
    return NextResponse.json({ ok: false, error: 'cannot_restore' }, { status: 410 })
  }

  const periodEndMs = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0
  if (!periodEndMs || Date.now() >= periodEndMs) {
    return NextResponse.json({ ok: false, error: 'cannot_restore' }, { status: 410 })
  }

  let updatedSub: any
  try {
    updatedSub = await stripe.subscriptions.update(
      stripeSubscriptionId,
      { cancel_at_period_end: false },
      {
        idempotencyKey: `boo-cancel-1b-restore:${stripeSubscriptionId}:${Math.floor(
          Date.now() / 1000
        )}`
      } as any
    )
  } catch (e: any) {
    console.error('[billing/restore] stripe.subscriptions.update failed', e?.message || e)
    return NextResponse.json(
      { ok: false, error: 'stripe_update_failed' },
      { status: 500 }
    )
  }

  const periodEndIso = updatedSub?.current_period_end
    ? new Date(updatedSub.current_period_end * 1000).toISOString()
    : sub.currentPeriodEnd || null

  await businessesCol.updateOne(
    { $or: [{ businessId }, { id: businessId }] },
    {
      $set: {
        'subscription.cancelAtPeriodEnd': false,
        'subscription.currentPeriodEnd': periodEndIso,
        updatedAt: new Date()
      },
      $unset: {
        'subscription.cancellationRequestedAt': '',
        'subscription.cancellationReason': '',
        'subscription.cancellationMode': ''
      }
    }
  )

  await writeAuditLog(db, {
    event: 'subscription_restored',
    businessId,
    userId,
    stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId || null,
    createdAt: new Date()
  })

  const owner = await db.collection('users').findOne({ id: userId })
  const ownerEmail = owner?.email || business.ownerEmail || null
  if (ownerEmail) {
    sendSubscriptionRestoredEmail({
      to: ownerEmail,
      businessName: business.name || 'your business',
      currentPeriodEnd: periodEndIso
    }).catch((e) => console.error('[billing/restore] email failed', e?.message || e))
  }

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: periodEndIso
  })
}
