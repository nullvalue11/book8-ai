/**
 * POST /api/internal/outlook-delete-event
 *
 * Internal endpoint for core-api to delete a Microsoft Outlook event by event id.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, eventId }
 * Response: { ok: true, deleted: true } (or deleted:false with reason)
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

    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid businessId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid eventId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const database = await connect()
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      businessId: businessId.trim()
    })
    if (!business) return NextResponse.json({ ok: true, deleted: false, reason: 'business_not_found' })

    const ownerUserId = business.ownerUserId
    if (!ownerUserId) return NextResponse.json({ ok: true, deleted: false, reason: 'missing_owner' })

    const user = await database.collection('users').findOne({ id: ownerUserId })
    if (!user) return NextResponse.json({ ok: true, deleted: false, reason: 'user_not_found' })

    const ms = user.microsoft || {}
    if (!ms.refreshToken || ms.connected !== true) {
      return NextResponse.json({ ok: true, deleted: false, reason: 'microsoft_not_connected' })
    }
    if (ms.needsReconnect === true) {
      return NextResponse.json({ ok: true, deleted: false, reason: 'microsoft_needs_reconnect' })
    }

    try {
      const tokenRes = await getMicrosoftAccessToken(ms.refreshToken)
      if (tokenRes.refreshToken) {
        await database.collection('users').updateOne(
          { id: ownerUserId },
          { $set: { 'microsoft.refreshToken': tokenRes.refreshToken, updatedAt: new Date() } }
        )
      }

      const resp = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenRes.accessToken}` }
      })

      // Graph returns 204 No Content on success.
      if (resp.ok || resp.status === 204) {
        return NextResponse.json({ ok: true, deleted: true, eventId })
      }

      return NextResponse.json({
        ok: true,
        deleted: false,
        eventId,
        reason: `delete_failed_${resp.status}`
      })
    } catch (err) {
      console.error('[internal/outlook-delete-event] Microsoft error:', err?.message || err)
      const msg = err?.message || String(err)
      const isInvalidGrant =
        msg.includes('invalid_grant') || msg.includes('AADSTS') || msg.includes('expired')
      if (isInvalidGrant) {
        await database.collection('users').updateOne(
          { id: ownerUserId },
          {
            $set: {
              'microsoft.needsReconnect': true,
              'microsoft.lastError': new Date().toISOString(),
              updatedAt: new Date()
            }
          }
        )
      }
      return NextResponse.json({ ok: true, deleted: false, eventId, reason: 'microsoft_error' })
    }
  } catch (err) {
    console.error('[internal/outlook-delete-event] Error:', err?.message || err)
    return NextResponse.json({ ok: true, deleted: false, reason: 'error' })
  }
}

