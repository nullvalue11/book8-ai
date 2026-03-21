/**
 * POST /api/internal/outlook-update-event
 *
 * Internal endpoint for core-api to UPDATE a Microsoft Outlook event (e.g. mark as CANCELLED).
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
import { getMicrosoftAccessToken } from '@/lib/microsoft-calendar'

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
  const provided =
    request.headers.get('x-book8-internal-secret') ||
    request.headers.get('x-internal-secret') ||
    ''
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

    const ownerUserId = business.ownerUserId
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

    const ms = user.microsoft || {}
    if (!ms.refreshToken || ms.connected !== true) {
      return NextResponse.json(
        { ok: false, error: 'no_microsoft_token', reason: 'microsoft_not_connected' },
        { status: 404 }
      )
    }
    if (ms.needsReconnect === true) {
      return NextResponse.json(
        { ok: false, error: 'microsoft_needs_reconnect' },
        { status: 404 }
      )
    }

    const tokenRes = await getMicrosoftAccessToken(ms.refreshToken)
    if (tokenRes.refreshToken) {
      await database.collection('users').updateOne(
        { id: ownerUserId },
        {
          $set: {
            'microsoft.refreshToken': tokenRes.refreshToken,
            updatedAt: new Date()
          }
        }
      )
    }

    const originalTitle = title && typeof title === 'string' ? title.trim() : 'This appointment'
    const updatePayload = {
      subject: `CANCELLED — ${originalTitle}`,
      showAs: showAs || 'free',
      body: {
        contentType: 'HTML',
        content: `<p><strong style="color: red;">⛔ CANCELLED</strong></p><p>${originalTitle}</p><p>Cancelled via Book8 AI</p>`
      }
    }

    console.log(
      '[outlook-update-event] Updating event:',
      eventId,
      'payload:',
      JSON.stringify(updatePayload)
    )

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenRes.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[outlook-update-event] Graph error:', response.status, errorData)
      return NextResponse.json(
        {
          ok: false,
          error: 'graph_error',
          graphStatus: response.status,
          graphError: errorData?.error?.code
        },
        { status: 502 }
      )
    }

    const data = await response.json().catch(() => ({}))
    console.log('[outlook-update-event] Event updated successfully:', eventId)

    return NextResponse.json({
      ok: true,
      eventId: data.id || eventId,
      updated: true
    })
  } catch (err) {
    console.error('[outlook-update-event] Error:', err?.message || err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Server error' },
      { status: 500 }
    )
  }
}
