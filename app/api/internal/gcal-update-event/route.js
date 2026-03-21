/**
 * POST /api/internal/gcal-update-event
 *
 * Internal endpoint for core-api to UPDATE a Google Calendar event (e.g. mark as CANCELLED).
 * Updates the event in place instead of deleting it so the cancellation is visible.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, eventId, title?, showAs? }
 * Response: { ok: true, eventId, updated: true } or { ok: false, error }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { createHash, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
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
  let ownerUserId = null
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

    const { businessId, eventId, title, showAs } = body || {}

    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'businessId and eventId required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'businessId and eventId required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const database = await connect()
    const bizId = businessId.trim()
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [{ businessId: bizId }, { id: bizId }]
    })
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'business_not_found' },
        { status: 404 }
      )
    }

    ownerUserId = business.ownerUserId
    if (!ownerUserId) {
      return NextResponse.json(
        { ok: false, error: 'no_owner', reason: 'missing_owner' },
        { status: 404 }
      )
    }

    const user = await database.collection('users').findOne({ id: ownerUserId })
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'user_not_found' },
        { status: 404 }
      )
    }

    const google = user.google || {}
    if (!google.refreshToken || google.connected !== true) {
      return NextResponse.json(
        { ok: false, error: 'no_google_token', reason: 'google_not_connected' },
        { status: 404 }
      )
    }
    if (google.needsReconnect === true) {
      return NextResponse.json(
        { ok: false, error: 'google_needs_reconnect' },
        { status: 404 }
      )
    }

    const selectedCalendarIds =
      Array.isArray(user.scheduling?.selectedCalendarIds) &&
      user.scheduling.selectedCalendarIds.length
        ? user.scheduling.selectedCalendarIds
        : Array.isArray(google.selectedCalendarIds) && google.selectedCalendarIds.length
          ? google.selectedCalendarIds
          : ['primary']
    const calendarId =
      business?.calendar?.calendarId || selectedCalendarIds[0] || 'primary'

    const originalTitle =
      title && typeof title === 'string' ? title.trim() : 'This appointment'
    const updatePayload = {
      summary: `CANCELLED — ${originalTitle}`,
      description: `⛔ CANCELLED\n\n${originalTitle}\n\nCancelled via Book8 AI`,
      colorId: '4'
    }
    if (showAs === 'free') {
      updatePayload.transparency = 'transparent'
    }

    console.log(
      '[gcal-update-event] Updating event:',
      eventId,
      'on calendar:',
      calendarId
    )

    const { google: gapi } = await import('googleapis')
    const oauth = new gapi.auth.OAuth2(
      env.GOOGLE?.CLIENT_ID,
      env.GOOGLE?.CLIENT_SECRET,
      env.GOOGLE?.REDIRECT_URI
    )
    oauth.setCredentials({ refresh_token: google.refreshToken })
    const calendar = gapi.calendar({ version: 'v3', auth: oauth })

    const result = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updatePayload,
      sendUpdates: 'all'
    })

    console.log('[gcal-update-event] Event updated successfully:', eventId)

    return NextResponse.json({
      ok: true,
      eventId: result.data?.id || eventId,
      updated: true
    })
  } catch (err) {
    console.error('[gcal-update-event] Error:', err?.message || err)
    const isInvalidGrant =
      err?.message?.includes('invalid_grant') ||
      err?.code === 401 ||
      err?.response?.status === 401
    if (isInvalidGrant && ownerUserId) {
      try {
        const database = await connect()
        await database.collection('users').updateOne(
          { id: ownerUserId },
          {
            $set: {
              'google.needsReconnect': true,
              'google.lastError': new Date().toISOString(),
              updatedAt: new Date()
            }
          }
        )
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
}
