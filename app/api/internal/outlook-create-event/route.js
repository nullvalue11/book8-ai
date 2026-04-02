/**
 * POST /api/internal/outlook-create-event
 *
 * Internal endpoint for core-api to create a Microsoft Outlook Calendar event when a
 * booking is created via the AI phone agent.
 *
 * Auth: x-book8-internal-secret must match env.CORE_API_INTERNAL_SECRET
 * Body: { businessId, bookingId?, title, description?, start, end, timezone?, customer? }
 * Response: { ok: true, eventId, calendarId } or { ok: true, eventId: null, reason }
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

function noConnection(reason = 'no_microsoft_connection') {
  return NextResponse.json({ ok: true, eventId: null, reason })
}

/**
 * Graph expects dateTime + timeZone; ISO strings with a trailing Z often fail validation.
 * Format the instant as wall-clock time in the given IANA zone (e.g. America/Toronto).
 */
function formatDateTimeInZone(isoStr, timeZone) {
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return isoStr.replace(/Z$/i, '').replace(/\.\d{3}$/, '')
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = fmt.formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
}

function decodeJwtInfo(token) {
  try {
    if (!token || typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8')
    const payload = JSON.parse(payloadJson)
    return {
      aud: payload?.aud,
      iss: payload?.iss,
      exp: payload?.exp
    }
  } catch {
    return null
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

    const { businessId, bookingId, title, description, start: startStr, end: endStr, timezone, customer } = body || {}

    if (!businessId || typeof businessId !== 'string' || !businessId.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid businessId', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid title', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!startStr || typeof startStr !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid start (ISO date-time)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (!endStr || typeof endStr !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid end (ISO date-time)', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const startDate = new Date(startStr)
    const endDate = new Date(endStr)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Invalid start/end date format', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    if (startDate >= endDate) {
      return NextResponse.json(
        { ok: false, error: 'start must be before end', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const database = await connect()
    const bizId = businessId.trim()
    // Support both businessId (book8 schema) and id (core-api test schema)
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [{ businessId: bizId }, { id: bizId }]
    })
    if (!business) return noConnection('business_not_found')

    const ownerUserId = business.ownerUserId
    if (!ownerUserId) return noConnection()

    const user = await database.collection('users').findOne({ id: ownerUserId })
    if (!user) return noConnection()

    const ms = user.microsoft || {}
    if (!ms.refreshToken || ms.connected !== true) return noConnection('microsoft_not_connected')
    if (ms.needsReconnect === true) return noConnection('microsoft_needs_reconnect')

    const scheduleId =
      business?.calendar?.calendarId ||
      ms.email ||
      user.email ||
      null

    const resolvedTimezone = timezone && typeof timezone === 'string' ? timezone : 'America/Toronto'

    const startGraph = formatDateTimeInZone(startStr, resolvedTimezone)
    const endGraph = formatDateTimeInZone(endStr, resolvedTimezone)

    const eventPayload = {
      subject: String(title).trim() || 'Book8-AI Appointment',
      start: {
        dateTime: startGraph,
        timeZone: resolvedTimezone
      },
      end: {
        dateTime: endGraph,
        timeZone: resolvedTimezone
      },
      body: {
        contentType: 'HTML',
        content: description && typeof description === 'string' ? description : ''
      },
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
      showAs: 'busy'
    }

    // Fire-and-forget pattern: if Microsoft fails, still respond ok:true (with reason when possible).
    let eventId = null
    try {
      console.log('[outlook-create-event] Attempting to create event for business:', businessId.trim())
      console.log('[outlook-create-event] ownerUserId:', ownerUserId, 'scheduleId:', scheduleId)
      console.log('[outlook-create-event] Payload times:', {
        startRaw: startStr,
        endRaw: endStr,
        startGraph,
        endGraph,
        timeZone: resolvedTimezone
      })

      const tokenRes = await getMicrosoftAccessToken(ms.refreshToken)
      const tokenInfo = decodeJwtInfo(tokenRes.accessToken)
      const tokenPayload = tokenRes.accessToken
        ? (() => {
            try {
              return JSON.parse(Buffer.from(tokenRes.accessToken.split('.')[1], 'base64').toString())
            } catch {
              return null
            }
          })()
        : null
      console.log('[outlook-create-event] Token refresh result:', {
        hasAccessToken: !!tokenRes.accessToken,
        tokenLength: tokenRes.accessToken?.length,
        tokenPrefix: tokenRes.accessToken ? `${tokenRes.accessToken.substring(0, 30)}...` : '(missing)',
        tokenScopes: tokenPayload?.scp ?? tokenPayload?.roles ?? '(none)'
      })

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

      console.log('[outlook-create-event] Request body:', JSON.stringify(eventPayload, null, 2))

      const graphRes = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenRes.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      })

      const responseText = await graphRes.text()
      let responseData = {}
      try {
        responseData = responseText ? JSON.parse(responseText) : {}
      } catch {
        responseData = { parseError: true, raw: responseText?.slice(0, 500) }
      }

      console.log('[outlook-create-event] Graph API response status:', graphRes.status)
      console.log('[outlook-create-event] Graph API response:', JSON.stringify(responseData))

      if (!graphRes.ok) {
        console.error(
          '[outlook-create-event] Graph API error:',
          responseData?.error?.code,
          responseData?.error?.message
        )

        // If Graph says Unauthorized, the stored refresh token likely no longer yields a usable access token.
        // Mark as needing reconnect so the user can re-authorize with the correct scopes.
        if (graphRes.status === 401) {
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

        return NextResponse.json({
          ok: true,
          eventId: null,
          calendarId: scheduleId,
          reason: 'graph_error',
          graphStatus: graphRes.status,
          graphErrorCode: responseData?.error?.code,
          graphErrorMessage: responseData?.error?.message,
          // Include raw response so core-api logs can surface the real Graph error.
          graphResponse: responseData,
          tokenInfo,
          tokenScopes: tokenPayload?.scp ?? tokenPayload?.roles ?? null
        })
      }

      eventId = responseData?.id || null
      if (!eventId) {
        console.warn(
          '[outlook-create-event] Graph 200 but no id in body; keys:',
          responseData && typeof responseData === 'object' ? Object.keys(responseData).join(',') : typeof responseData
        )
      }

      if (eventId) {
        await database.collection('users').updateOne(
          { id: ownerUserId },
          { $set: { 'microsoft.lastSyncedAt': new Date().toISOString(), updatedAt: new Date() } }
        )
      }
    } catch (err) {
      console.error('[internal/outlook-create-event] Microsoft error:', err?.message || err)
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
      return noConnection('microsoft_error')
    }

    return NextResponse.json({
      ok: true,
      eventId: eventId || null,
      calendarId: scheduleId,
      ...(eventId ? {} : { reason: 'graph_missing_id' })
    })
  } catch (err) {
    console.error('[internal/outlook-create-event] Error:', err?.message || err)
    return NextResponse.json({ ok: true, eventId: null, reason: 'error' })
  }
}

