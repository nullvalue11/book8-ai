/**
 * POST /api/internal/gcal-delete-event
 *
 * Internal endpoint for core-api (or book8-ai) to remove a Google Calendar event.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, eventId }
 * Response: { ok: true, deleted: true } | { ok: true, deleted: false, reason }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { createHash, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
import { deleteGoogleCalendarEventForBusiness } from '@/lib/bookingCalendarGcal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function validateInternalSecret(request) {
  const expected = env.CORE_API_INTERNAL_SECRET || ''
  const provided = request.headers.get('x-book8-internal-secret') || ''
  if (!expected || !provided) return false
  if (provided.length !== expected.length) return false
  try {
    const a = createHash('sha256').update(provided, 'utf8').digest()
    const b = createHash('sha256').update(expected, 'utf8').digest()
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request) {
  try {
    if (!validateInternalSecret(request)) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const { businessId, eventId } = body || {}
    if (!businessId || typeof businessId !== 'string' || !String(businessId).trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing businessId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!eventId || typeof eventId !== 'string' || !String(eventId).trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing eventId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const database = await connect()
    const result = await deleteGoogleCalendarEventForBusiness(database, env, {
      businessId: String(businessId).trim(),
      eventId: String(eventId).trim(),
      logPrefix: '[internal/gcal-delete-event]'
    })

    return NextResponse.json({
      ok: true,
      deleted: result.deleted === true,
      reason: result.reason
    })
  } catch (err) {
    console.error('[internal/gcal-delete-event] Error:', err?.message || err)
    return NextResponse.json({ ok: true, deleted: false, reason: 'error' })
  }
}
