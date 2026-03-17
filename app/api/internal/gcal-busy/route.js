/**
 * POST /api/internal/gcal-busy
 *
 * Internal endpoint for core-api to get Google Calendar busy times for a business.
 * Used by the voice agent's availability engine to respect the business owner's calendar.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, from, to, timezone? }
 * Response: { ok: true, busy: [ { start, end }, ... ] } — never 500 on Google issues.
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

function emptyBusy() {
  return NextResponse.json({ ok: true, busy: [] })
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

    const { businessId, from: fromStr, to: toStr, timezone } = body || {}
    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid businessId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!fromStr || typeof fromStr !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid from (ISO date-time)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!toStr || typeof toStr !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid to (ISO date-time)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const fromDate = new Date(fromStr)
    const toDate = new Date(toStr)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid from/to date format', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (fromDate >= toDate) {
      return NextResponse.json(
        { ok: false, error: 'from must be before to', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const database = await connect()
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      businessId: businessId.trim()
    })
    if (!business) {
      return emptyBusy()
    }

    const ownerUserId = business.ownerUserId
    if (!ownerUserId) {
      return emptyBusy()
    }

    const user = await database.collection('users').findOne({ id: ownerUserId })
    if (!user) {
      return emptyBusy()
    }

    const google = user.google || {}
    if (!google.refreshToken || google.connected !== true) {
      return emptyBusy()
    }
    if (google.needsReconnect === true) {
      return emptyBusy()
    }

    const selectedCalendarIds =
      Array.isArray(user.scheduling?.selectedCalendarIds) && user.scheduling.selectedCalendarIds.length
        ? user.scheduling.selectedCalendarIds
        : (Array.isArray(google.selectedCalendarIds) && google.selectedCalendarIds.length
            ? google.selectedCalendarIds
            : ['primary'])

    let busySlots
    try {
      const { google: gapi } = await import('googleapis')
      const oauth = new gapi.auth.OAuth2(
        env.GOOGLE?.CLIENT_ID,
        env.GOOGLE?.CLIENT_SECRET,
        env.GOOGLE?.REDIRECT_URI
      )
      oauth.setCredentials({ refresh_token: google.refreshToken })
      const calendar = gapi.calendar({ version: 'v3', auth: oauth })

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: fromDate.toISOString(),
          timeMax: toDate.toISOString(),
          items: selectedCalendarIds.map((id) => ({ id }))
        }
      })

      busySlots = []
      for (const calId of selectedCalendarIds) {
        const cal = response.data.calendars?.[calId]
        if (cal?.busy) {
          busySlots.push(...cal.busy)
        }
      }
    } catch (err) {
      console.error('[internal/gcal-busy] Google freebusy error:', err?.message || err)
      const isInvalidGrant =
        err?.message?.includes('invalid_grant') ||
        err?.code === 401 ||
        err?.response?.status === 401
      if (isInvalidGrant) {
        await database
          .collection('users')
          .updateOne(
            { id: ownerUserId },
            {
              $set: {
                'google.needsReconnect': true,
                'google.lastError': new Date().toISOString()
              }
            }
          )
      }
      return emptyBusy()
    }

    const busy = busySlots
      .map((b) => ({ start: b.start, end: b.end }))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({ ok: true, busy })
  } catch (err) {
    console.error('[internal/gcal-busy] Error:', err?.message || err)
    return NextResponse.json({ ok: true, busy: [] })
  }
}
