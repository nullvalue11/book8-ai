// @ts-nocheck
/**
 * POST /api/billing/cancel
 *
 * BOO-CANCEL-1B — cancel a subscription.
 *
 * Body: {
 *   businessId: string,
 *   mode: 'immediate' | 'period_end',
 *   surveyResponse?: string  (max 500 chars)
 * }
 *
 * Auth: NextAuth session cookie (getToken) or Bearer JWT (same secret as NextAuth).
 *
 * Path A (mode='immediate'):
 *   1. Server-side eligibility: subscription.created < 14 days ago. Else 400 refund_window_expired.
 *   2. Find last successful charge via stripe.charges.list({ customer, limit: 1 }).
 *   3. Refund FIRST: stripe.refunds.create({ charge, reason: 'requested_by_customer' }).
 *      If refund fails -> 500 refund_failed, Mongo state unchanged.
 *   4. Cancel sub: stripe.subscriptions.cancel(subscriptionId).
 *      If cancel fails -> 500 cancel_failed_after_refund (audit logged, manual recovery).
 *   5. Mongo updates + Path A email.
 *
 * Path B (mode='period_end'):
 *   1. stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true }).
 *   2. Mongo updates + Path B email.
 *
 * Advisory lock: if subscription.cancellationRequestedAt is within last 30 sec, return 409.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MongoClient, type Db, type Collection } from 'mongodb'
import jwt from 'jsonwebtoken'
import { getToken } from 'next-auth/jwt'
// @ts-ignore - env.js is a JavaScript module
import { env } from '@/lib/env.js'
import { getStripe } from '@/lib/stripeSubscription'
import { COLLECTION_NAME, SUBSCRIPTION_STATUS } from '@/lib/schemas/business'
import {
  sendImmediateCancelWithRefundEmail,
  sendCancelAtPeriodEndEmail
} from '@/lib/cancellationEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const CANCELLATION_LOCK_MS = 30 * 1000
const SURVEY_MAX_CHARS = 500

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

async function authenticate(request: NextRequest): Promise<AuthResult> {
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (!token) return { error: 'Authentication required', status: 401 }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string }
      if (!payload?.sub) return { error: 'Invalid token payload', status: 401 }
      return { userId: payload.sub }
    } catch {
      return { error: 'Invalid or expired token', status: 401 }
    }
  }
  const secret = env.NEXTAUTH_SECRET || env.JWT_SECRET
  try {
    const sessionJwt = await getToken({ req: request, secret })
    const userId =
      (sessionJwt as { userId?: string } | null)?.userId ||
      (sessionJwt?.sub as string | undefined) ||
      null
    if (!userId) return { error: 'Authentication required', status: 401 }
    return { userId }
  } catch {
    return { error: 'Authentication required', status: 401 }
  }
}

async function clearAdvisoryLock(
  businessesCol: Collection,
  businessId: string
): Promise<void> {
  try {
    await businessesCol.updateOne(
      { $or: [{ businessId }, { id: businessId }] },
      {
        $unset: { 'subscription.cancellationRequestedAt': '' },
        $set: { updatedAt: new Date() }
      }
    )
  } catch (e) {
    console.error('[billing/cancel] clearAdvisoryLock failed', (e as Error)?.message)
  }
}

interface CancelLogEntry {
  event: 'subscription_cancelled' | 'subscription_cancel_failed_after_refund' | 'refund_failed'
  mode: 'immediate' | 'period_end'
  businessId: string
  userId: string
  stripeSubscriptionId?: string | null
  stripeCustomerId?: string | null
  refundId?: string | null
  refundAmountCents?: number | null
  surveyResponse?: string | null
  error?: string | null
  createdAt: Date
}

async function writeAuditLog(db: Db, entry: CancelLogEntry): Promise<void> {
  try {
    await db.collection('billing_audit_logs').insertOne(entry as any)
  } catch (e) {
    console.error('[billing/cancel] audit log insert failed', (e as Error)?.message)
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 })
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
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
  const mode: string | undefined = body?.mode
  const surveyResponseRaw: unknown = body?.surveyResponse

  if (!businessId || typeof businessId !== 'string') {
    return NextResponse.json({ ok: false, error: 'businessId is required' }, { status: 400 })
  }
  if (mode !== 'immediate' && mode !== 'period_end') {
    return NextResponse.json(
      { ok: false, error: "mode must be 'immediate' or 'period_end'" },
      { status: 400 }
    )
  }
  if (typeof surveyResponseRaw !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'surveyResponse is required (string)' },
      { status: 400 }
    )
  }
  if (surveyResponseRaw.length > SURVEY_MAX_CHARS) {
    return NextResponse.json(
      { ok: false, error: `surveyResponse exceeds ${SURVEY_MAX_CHARS} chars` },
      { status: 400 }
    )
  }
  const surveyResponse = surveyResponseRaw.trim() || null

  const stripe = await getStripe()
  if (!stripe) {
    return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 503 })
  }

  let db: Db
  try {
    db = await connectToDatabase()
  } catch (e) {
    console.error('[billing/cancel] db connect failed', e)
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
  const stripeCustomerId: string | null = sub.stripeCustomerId || null

  if (!stripeSubscriptionId || !stripeCustomerId) {
    return NextResponse.json(
      { ok: false, error: 'No active Stripe subscription on this business' },
      { status: 400 }
    )
  }

  if (
    sub.status === SUBSCRIPTION_STATUS.CANCELED ||
    String(sub.status).toLowerCase() === 'canceled'
  ) {
    return NextResponse.json(
      { ok: false, error: 'Subscription is already cancelled' },
      { status: 409 }
    )
  }

  const now = new Date()
  const lastRequestedAt = sub.cancellationRequestedAt
    ? new Date(sub.cancellationRequestedAt).getTime()
    : 0
  if (lastRequestedAt && now.getTime() - lastRequestedAt < CANCELLATION_LOCK_MS) {
    return NextResponse.json(
      { ok: false, error: 'cancellation_in_progress' },
      { status: 409 }
    )
  }

  const lockCutoffIso = new Date(now.getTime() - CANCELLATION_LOCK_MS).toISOString()
  const lockResult = await businessesCol.updateOne(
    {
      $and: [
        { $or: [{ businessId }, { id: businessId }] },
        {
          $or: [
            { 'subscription.cancellationRequestedAt': { $exists: false } },
            { 'subscription.cancellationRequestedAt': null },
            { 'subscription.cancellationRequestedAt': { $lt: lockCutoffIso } }
          ]
        }
      ]
    },
    {
      $set: {
        'subscription.cancellationRequestedAt': now.toISOString(),
        updatedAt: now
      }
    }
  )
  if (lockResult.matchedCount === 0) {
    return NextResponse.json(
      { ok: false, error: 'cancellation_in_progress' },
      { status: 409 }
    )
  }

  const owner = await db.collection('users').findOne({ id: userId })
  const ownerEmail = owner?.email || business.ownerEmail || null
  const businessName = business.name || 'your business'

  if (mode === 'immediate') {
    let stripeSub: any
    try {
      stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    } catch (e: any) {
      console.error('[billing/cancel] stripe.subscriptions.retrieve failed', e?.message || e)
      await writeAuditLog(db, {
        event: 'refund_failed',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        error: `retrieve_failed: ${e?.message || 'unknown'}`,
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json(
        { ok: false, error: 'stripe_retrieve_failed' },
        { status: 500 }
      )
    }

    const createdMs = (stripeSub?.created || 0) * 1000
    if (!createdMs || Date.now() - createdMs >= REFUND_WINDOW_MS) {
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json(
        { ok: false, error: 'refund_window_expired' },
        { status: 400 }
      )
    }

    let lastCharge: any = null
    try {
      const charges = await stripe.charges.list({ customer: stripeCustomerId, limit: 1 })
      lastCharge = charges?.data?.[0] || null
    } catch (e: any) {
      console.error('[billing/cancel] stripe.charges.list failed', e?.message || e)
      await writeAuditLog(db, {
        event: 'refund_failed',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        error: `charges_list_failed: ${e?.message || 'unknown'}`,
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json({ ok: false, error: 'refund_failed' }, { status: 500 })
    }

    if (!lastCharge?.id || lastCharge.status !== 'succeeded') {
      await writeAuditLog(db, {
        event: 'refund_failed',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        error: 'no_successful_charge',
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json({ ok: false, error: 'refund_failed' }, { status: 500 })
    }

    let refund: any
    try {
      refund = await stripe.refunds.create(
        {
          charge: lastCharge.id,
          reason: 'requested_by_customer'
        },
        {
          idempotencyKey: `boo-cancel-1b-refund:${stripeSubscriptionId}:${lastCharge.id}`
        }
      )
    } catch (e: any) {
      console.error('[billing/cancel] stripe.refunds.create failed', e?.message || e)
      await writeAuditLog(db, {
        event: 'refund_failed',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        error: `refund_create_failed: ${e?.message || 'unknown'}`,
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json({ ok: false, error: 'refund_failed' }, { status: 500 })
    }

    if (!refund || (refund.status && refund.status === 'failed')) {
      await writeAuditLog(db, {
        event: 'refund_failed',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        error: `refund_status:${refund?.status || 'unknown'}`,
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json({ ok: false, error: 'refund_failed' }, { status: 500 })
    }

    const refundedAmountCents = refund.amount ?? lastCharge.amount ?? 0
    const refundedCurrency = refund.currency || lastCharge.currency || 'usd'

    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId)
    } catch (e: any) {
      console.error(
        '[billing/cancel] stripe.subscriptions.cancel failed AFTER refund',
        e?.message || e
      )
      await writeAuditLog(db, {
        event: 'subscription_cancel_failed_after_refund',
        mode: 'immediate',
        businessId,
        userId,
        stripeSubscriptionId,
        stripeCustomerId,
        refundId: refund?.id || null,
        refundAmountCents: refundedAmountCents,
        surveyResponse,
        error: e?.message || 'unknown',
        createdAt: new Date()
      })
      await clearAdvisoryLock(businessesCol, businessId)
      return NextResponse.json(
        { ok: false, error: 'cancel_failed_after_refund' },
        { status: 500 }
      )
    }

    const nowIso = new Date().toISOString()
    await businessesCol.updateOne(
      { $or: [{ businessId }, { id: businessId }] },
      {
        $set: {
          'subscription.status': SUBSCRIPTION_STATUS.CANCELED,
          'subscription.canceledAt': nowIso,
          'subscription.cancellationReason': surveyResponse,
          'subscription.cancellationMode': 'immediate',
          'subscription.refundedAt': nowIso,
          'subscription.refundAmountCents': refundedAmountCents,
          'subscription.refundCurrency': refundedCurrency,
          'subscription.refundId': refund?.id || null,
          'subscription.cancelAtPeriodEnd': false,
          softDeletedAt: nowIso,
          'features.billingEnabled': false,
          updatedAt: new Date()
        }
      }
    )

    await writeAuditLog(db, {
      event: 'subscription_cancelled',
      mode: 'immediate',
      businessId,
      userId,
      stripeSubscriptionId,
      stripeCustomerId,
      refundId: refund?.id || null,
      refundAmountCents: refundedAmountCents,
      surveyResponse,
      createdAt: new Date()
    })

    if (ownerEmail) {
      sendImmediateCancelWithRefundEmail({
        to: ownerEmail,
        businessName,
        refundAmountCents: refundedAmountCents,
        refundCurrency: refundedCurrency
      }).catch((e) =>
        console.error('[billing/cancel] Path A email failed', e?.message || e)
      )
    }

    return NextResponse.json({
      ok: true,
      mode: 'immediate',
      refundAmountCents: refundedAmountCents,
      refundCurrency: refundedCurrency,
      refundId: refund?.id || null,
      canceledAt: nowIso
    })
  }

  // Path B: cancel at period end
  let updatedSub: any
  try {
    updatedSub = await stripe.subscriptions.update(
      stripeSubscriptionId,
      { cancel_at_period_end: true },
      {
        idempotencyKey: `boo-cancel-1b-period-end:${stripeSubscriptionId}:${Math.floor(
          now.getTime() / 1000
        )}`
      } as any
    )
  } catch (e: any) {
    console.error('[billing/cancel] stripe.subscriptions.update (period_end) failed', e?.message || e)
    await clearAdvisoryLock(businessesCol, businessId)
    return NextResponse.json(
      { ok: false, error: 'stripe_update_failed' },
      { status: 500 }
    )
  }

  const periodEndIso = updatedSub?.current_period_end
    ? new Date(updatedSub.current_period_end * 1000).toISOString()
    : sub.currentPeriodEnd || null

  const nowIso = new Date().toISOString()
  await businessesCol.updateOne(
    { $or: [{ businessId }, { id: businessId }] },
    {
      $set: {
        'subscription.cancelAtPeriodEnd': true,
        'subscription.cancellationRequestedAt': nowIso,
        'subscription.cancellationReason': surveyResponse,
        'subscription.cancellationMode': 'period_end',
        'subscription.currentPeriodEnd': periodEndIso,
        updatedAt: new Date()
      }
    }
  )

  await writeAuditLog(db, {
    event: 'subscription_cancelled',
    mode: 'period_end',
    businessId,
    userId,
    stripeSubscriptionId,
    stripeCustomerId,
    surveyResponse,
    createdAt: new Date()
  })

  if (ownerEmail) {
    sendCancelAtPeriodEndEmail({
      to: ownerEmail,
      businessName,
      currentPeriodEnd: periodEndIso
    }).catch((e) => console.error('[billing/cancel] Path B email failed', e?.message || e))
  }

  return NextResponse.json({
    ok: true,
    mode: 'period_end',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: periodEndIso
  })
}

