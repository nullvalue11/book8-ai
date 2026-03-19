/**
 * POST /api/internal/outlook-busy
 *
 * Internal endpoint for core-api to get Microsoft/Outlook calendar busy times for a business.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, from, to, timezone? }
 * Response: { ok: true, busy: [ { start, end }, ... ] } — never 500 on Microsoft issues.
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

function emptyBusy() {
  return NextResponse.json({ ok: true, busy: [] })
}

function pickStartEnd(item) {
  const start =
    item?.startDateTime ||
    item?.start?.dateTime ||
    item?.start?.date ||
    null
  const end =
    item?.endDateTime ||
    item?.end?.dateTime ||
    item?.end?.date ||
    null
  return { start, end }
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
    if (!business) return emptyBusy()

    const ownerUserId = business.ownerUserId
    if (!ownerUserId) return emptyBusy()

    const user = await database.collection('users').findOne({ id: ownerUserId })
    if (!user) return emptyBusy()

    const ms = user.microsoft || {}
    if (!ms.refreshToken || ms.connected !== true) return emptyBusy()
    if (ms.needsReconnect === true) return emptyBusy()

    const scheduleId =
      business?.calendar?.calendarId ||
      ms.email ||
      user.email ||
      null
    if (!scheduleId) return emptyBusy()

    let accessToken
    try {
      const tokenRes = await getMicrosoftAccessToken(ms.refreshToken)
      accessToken = tokenRes.accessToken
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
    } catch (tokenErr) {
      const msg = tokenErr?.message || String(tokenErr)
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
      return emptyBusy()
    }

    const resolvedTimezone = timezone && typeof timezone === 'string' ? timezone : 'America/Toronto'

    let msResponse
    try {
      msResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schedules: [scheduleId],
          startTime: { dateTime: fromDate.toISOString(), timeZone: resolvedTimezone },
          endTime: { dateTime: toDate.toISOString(), timeZone: resolvedTimezone },
          availabilityViewInterval: 15
        })
      })
    } catch {
      return emptyBusy()
    }

    const data = await msResponse.json().catch(() => ({}))
    if (!msResponse.ok) return emptyBusy()

    const scheduleItems = data?.value?.[0]?.scheduleItems || []

    const busy = scheduleItems
      .filter((item) => {
        const status = String(item?.status || '').toLowerCase()
        return status && status !== 'free'
      })
      .map((item) => {
        const { start, end } = pickStartEnd(item)
        return { start, end }
      })
      .filter((x) => x.start && x.end)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return NextResponse.json({ ok: true, busy })
  } catch (err) {
    console.error('[internal/outlook-busy] Error:', err?.message || err)
    return NextResponse.json({ ok: true, busy: [] })
  }
}

