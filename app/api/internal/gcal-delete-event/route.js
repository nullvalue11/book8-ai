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
import { resolveCalendarIdForUser } from '@/lib/bookingCalendarGcal'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

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

    console.log('[gcal-delete-event][debug] Received:', {
      businessId: body?.businessId,
      eventId: body?.eventId,
      bodyKeys: Object.keys(body || {})
    })

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

    const bizId = String(businessId).trim()
    const evId = String(eventId).trim()

    const database = await connect()
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [{ businessId: bizId }, { id: bizId }]
    })
    if (!business?.ownerUserId) {
      return NextResponse.json({
        ok: true,
        deleted: false,
        reason: 'no_owner'
      })
    }

    const user = await database.collection('users').findOne({ id: business.ownerUserId })
    const google = user?.google || {}
    if (!google.refreshToken || google.connected !== true) {
      return NextResponse.json({
        ok: true,
        deleted: false,
        reason: 'no_google_token'
      })
    }
    if (google.needsReconnect === true) {
      return NextResponse.json({
        ok: true,
        deleted: false,
        reason: 'needs_reconnect'
      })
    }

    const calendarId = resolveCalendarIdForUser(user)

    console.log('[gcal-delete-event][debug] Calling Google delete:', {
      calendarId,
      eventId: evId,
      userId: user?.id,
      hasRefreshToken: !!user?.google?.refreshToken
    })

    const { google: gapi } = await import('googleapis')
    const oauth = new gapi.auth.OAuth2(
      env.GOOGLE?.CLIENT_ID,
      env.GOOGLE?.CLIENT_SECRET,
      env.GOOGLE?.REDIRECT_URI
    )
    oauth.setCredentials({ refresh_token: google.refreshToken })
    const calendar = gapi.calendar({ version: 'v3', auth: oauth })

    try {
      await calendar.events.delete({ calendarId, eventId: evId })
      console.log('[gcal-delete-event][debug] Google delete success:', { eventId: evId, calendarId })
      return NextResponse.json({ ok: true, deleted: true })
    } catch (googleErr) {
      console.error('[gcal-delete-event][debug] Google delete error:', {
        message: googleErr?.message,
        code: googleErr?.code,
        status: googleErr?.response?.status,
        responseData: googleErr?.response?.data,
        errors: googleErr?.errors
      })
      throw googleErr
    }
  } catch (err) {
    console.error('[internal/gcal-delete-event] Error:', err?.message || err)
    return NextResponse.json({ ok: true, deleted: false, reason: 'error' })
  }
}
