/**
 * POST /api/public/bookings/setup-card
 * Creates Stripe Customer + SetupIntent for no-show card on file (BOO-45B).
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'
import { checkRateLimit } from '@/lib/rateLimiting'
import { RateLimitTelemetry } from '@/lib/telemetry'
import { sanitizeNoShowForPublic } from '@/lib/no-show-protection'

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

async function getStripe() {
  const Stripe = (await import('stripe')).default
  if (!env.STRIPE?.SECRET_KEY) return null
  return new Stripe(env.STRIPE.SECRET_KEY, { apiVersion: '2023-10-16' })
}

export async function POST(request) {
  try {
    const database = await connect()
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const handle = (body.handle || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const name = (body.name || '').trim() || undefined

    if (!handle || !email || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'handle and valid email required' },
        { status: 400 }
      )
    }

    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateLimit = checkRateLimit(email, 'publicBooking')
    if (!rateLimit.allowed) {
      RateLimitTelemetry.exceeded(email, 'publicBooking', clientIp)
      return NextResponse.json(
        { ok: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const business = await findBusinessByPublicHandle(database.collection(BUSINESS_COLLECTION), handle)
    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const policy = sanitizeNoShowForPublic(business)
    if (!policy.enabled) {
      return NextResponse.json({ ok: false, error: 'No-show protection is not enabled' }, { status: 400 })
    }

    const stripe = await getStripe()
    if (!stripe) {
      return NextResponse.json(
        { ok: false, error: 'Card setup is not available right now' },
        { status: 503 }
      )
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        businessId: String(business.businessId || ''),
        source: 'book8_no_show'
      }
    })

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        businessId: String(business.businessId || ''),
        guestEmail: email,
        source: 'book8_no_show'
      }
    })

    return NextResponse.json({
      ok: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      stripeCustomerId: customer.id
    })
  } catch (e) {
    console.error('[setup-card]', e)
    return NextResponse.json(
      { ok: false, error: e.message || 'Server error' },
      { status: 500 }
    )
  }
}
