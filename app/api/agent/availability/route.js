/**
 * POST /api/agent/availability
 * 
 * Purpose:
 * Let an AI phone agent check availability for a business.
 * Returns a list of available time slots in ISO format.
 * 
 * Authentication:
 * Requires `agentApiKey` in request body. The key must match
 * a phoneAgents[].agentApiKey entry in a user's document.
 * 
 * Request Body:
 * {
 *   "agentApiKey": "ag_sk_123...",      // Required - agent secret key
 *   "handle": "waismofit",               // Optional - defaults to owner's handle
 *   "date": "2025-12-01",                // Required - YYYY-MM-DD format
 *   "timezone": "America/Toronto",       // Optional - defaults to owner's timezone
 *   "durationMinutes": 30                // Optional - defaults to owner's default duration
 * }
 * 
 * Response (success):
 * {
 *   "ok": true,
 *   "handle": "waismofit",
 *   "date": "2025-12-01",
 *   "timezone": "America/Toronto",
 *   "slots": [
 *     "2025-12-01T14:00:00-05:00",
 *     "2025-12-01T14:30:00-05:00"
 *   ]
 * }
 * 
 * Response (error):
 * {
 *   "ok": false,
 *   "code": "AGENT_UNAUTHORIZED",
 *   "message": "Invalid agent API key."
 * }
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { 
  findAgentOwnerByKey, 
  AGENT_UNAUTHORIZED_ERROR,
  logAgentCall 
} from '@/lib/phoneAgent'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'

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

// Subscription required error for agent routes
const SUBSCRIPTION_REQUIRED_ERROR = {
  ok: false,
  code: 'SUBSCRIPTION_REQUIRED',
  message: 'The business owner\'s subscription is not active.',
  hint: 'The business needs an active subscription to use AI phone agent features.'
}

// Helper: Get Google FreeBusy
async function getGoogleFreeBusy(owner, startDate, endDate, selectedCalendarIds) {
  try {
    if (!owner.google?.refreshToken) {
      return { busy: [], error: null }
    }
    
    const { google } = await import('googleapis')
    const oauth = new google.auth.OAuth2(
      env.GOOGLE?.CLIENT_ID,
      env.GOOGLE?.CLIENT_SECRET,
      env.GOOGLE?.REDIRECT_URI
    )
    oauth.setCredentials({ refresh_token: owner.google.refreshToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth })

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        items: selectedCalendarIds.map(id => ({ id }))
      }
    })

    const busySlots = []
    for (const calId of selectedCalendarIds) {
      const cal = response.data.calendars?.[calId]
      if (cal?.busy) {
        busySlots.push(...cal.busy)
      }
    }

    return { busy: busySlots, error: null }
  } catch (error) {
    console.error('[agent:availability] FreeBusy error:', error.message)
    return { busy: [], error: error.message }
  }
}

// Helper: Check if slot is busy
function isSlotBusy(slotStart, slotEnd, busySlots) {
  for (const busy of busySlots) {
    const busyStart = new Date(busy.start)
    const busyEnd = new Date(busy.end)
    if (slotStart < busyEnd && slotEnd > busyStart) {
      return true
    }
  }
  return false
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}

export async function POST(request) {
  let resolvedHandle = null
  let agentLabel = null
  
  try {
    const body = await request.json()
    const { agentApiKey, handle, date, timezone, durationMinutes } = body

    // 1. Validate agentApiKey
    if (!agentApiKey) {
      logAgentCall('availability', { success: false, error: 'Missing agentApiKey' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing agentApiKey.',
        hint: 'Provide agentApiKey in the request body.'
      }, { status: 400 })
    }

    const agentResult = await findAgentOwnerByKey(agentApiKey)
    
    if (!agentResult) {
      logAgentCall('availability', { success: false, error: 'Invalid API key' })
      return NextResponse.json(AGENT_UNAUTHORIZED_ERROR, { status: 401 })
    }

    const { owner, agent } = agentResult
    agentLabel = agent.label || 'unnamed'
    
    // 2. Resolve handle (provided or from owner)
    resolvedHandle = handle || agentResult.handle
    
    if (!resolvedHandle) {
      logAgentCall('availability', { 
        handle: resolvedHandle, 
        agentLabel, 
        success: false, 
        error: 'No handle configured' 
      })
      return NextResponse.json({
        ok: false,
        code: 'HANDLE_NOT_CONFIGURED',
        message: 'No booking handle configured for this business.',
        hint: 'The business owner needs to set up their booking page handle.'
      }, { status: 400 })
    }

    // 3. Validate date
    if (!date) {
      logAgentCall('availability', { handle: resolvedHandle, agentLabel, success: false, error: 'Missing date' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Missing or invalid date.',
        hint: 'Provide date in YYYY-MM-DD format.'
      }, { status: 400 })
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      logAgentCall('availability', { handle: resolvedHandle, agentLabel, success: false, error: 'Invalid date format' })
      return NextResponse.json({
        ok: false,
        code: 'INVALID_INPUT',
        message: 'Invalid date format.',
        hint: 'Provide date in YYYY-MM-DD format (e.g., 2025-12-01).'
      }, { status: 400 })
    }

    // 4. Resolve timezone
    const resolvedTimezone = timezone || agentResult.timezone || 'UTC'

    // 5. Get owner settings
    const database = await connect()
    const settings = owner.scheduling || {}
    
    const selectedCalendarIds = 
      Array.isArray(settings.selectedCalendarIds) && settings.selectedCalendarIds.length
        ? settings.selectedCalendarIds
        : ['primary']
    
    const hostTz = settings.timeZone || 'UTC'
    const minNoticeMin = settings.minNoticeMin || 120
    const bufferMin = settings.bufferMin || 0
    const durationMin = durationMinutes || settings.defaultDurationMin || 30
    const workingHours = settings.workingHours || {}

    // 6. Parse date and get day slots
    const requestDate = new Date(date + 'T00:00:00')
    const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][requestDate.getDay()]
    const daySlots = workingHours[dayOfWeek] || []

    if (daySlots.length === 0) {
      logAgentCall('availability', { handle: resolvedHandle, agentLabel, success: true })
      return NextResponse.json({
        ok: true,
        handle: resolvedHandle,
        date,
        timezone: resolvedTimezone,
        slots: []
      })
    }

    // 7. Generate time slots
    const slots = []
    const now = new Date()
    const minStartTime = new Date(now.getTime() + minNoticeMin * 60000)

    for (const block of daySlots) {
      let currentTime = new Date(`${date}T${block.start}:00`)
      let endTime = block.end === '23:59' 
        ? new Date(`${date}T23:59:59`)
        : new Date(`${date}T${block.end}:00`)

      while (currentTime.getTime() + durationMin * 60000 <= endTime.getTime()) {
        if (currentTime >= minStartTime) {
          const slotEnd = new Date(currentTime.getTime() + durationMin * 60000)
          if (slotEnd <= endTime) {
            slots.push({
              start: currentTime.toISOString(),
              end: slotEnd.toISOString()
            })
          }
        }
        currentTime = new Date(currentTime.getTime() + (durationMin + bufferMin) * 60000)
      }
    }

    // 8. Check Google FreeBusy
    const startOfDay = new Date(date + 'T00:00:00')
    const endOfDay = new Date(date + 'T23:59:59')
    
    const freeBusyResult = await getGoogleFreeBusy(owner, startOfDay, endOfDay, selectedCalendarIds)

    // 9. Filter out busy slots
    const availableSlots = slots.filter(slot => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return !isSlotBusy(slotStart, slotEnd, freeBusyResult.busy)
    })

    // 10. Format slots as simple ISO strings for LLM friendliness
    const formattedSlots = availableSlots.map(slot => slot.start)

    logAgentCall('availability', { 
      handle: resolvedHandle, 
      agentLabel, 
      success: true 
    })

    return NextResponse.json({
      ok: true,
      handle: resolvedHandle,
      date,
      timezone: resolvedTimezone,
      slots: formattedSlots
    })

  } catch (error) {
    console.error('[agent:availability] Error:', error)
    logAgentCall('availability', { 
      handle: resolvedHandle, 
      agentLabel, 
      success: false, 
      error: error.message 
    })
    return NextResponse.json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      hint: error.message
    }, { status: 500 })
  }
}
