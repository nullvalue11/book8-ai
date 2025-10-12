import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { buildSlotsForDate, weekdayKey, slotsToResponse } from '@/app/lib/time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client, db
async function connect() { if (!client) { client = new MongoClient(process.env.MONGO_URL); await client.connect(); db = client.db(process.env.DB_NAME) } return db }

export async function OPTIONS() { return new Response(null, { status: 204 }) }

async function getCalendarClient(user) {
  try {
    const { google } = await import('googleapis')
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    if (!user?.google?.refreshToken) return null
    oauth2.setCredentials({ refresh_token: user.google.refreshToken })
    return google.calendar({ version: 'v3', auth: oauth2 })
  } catch { return null }
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = (url.searchParams.get('handle') || '').toLowerCase()
    const date = url.searchParams.get('date') // YYYY-MM-DD
    const guestTz = url.searchParams.get('tz') || 'UTC'
    if (!handle || !date) return NextResponse.json({ ok: false, error: 'Missing handle or date' }, { status: 400 })

    const database = await connect()
    const user = await database.collection('users').findOne({ 'scheduling.handleLower': handle })
    if (!user?.scheduling) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })

    const tz = user.scheduling.timeZone || 'UTC'
    const wkKey = weekdayKey(date, tz)
    const blocks = user.scheduling.workingHours?.[wkKey] || []
    const durationMin = Number(user.scheduling.defaultDurationMin || 30)
    const bufferMin = Number(user.scheduling.bufferMin || 0)
    const minNoticeMin = Number(user.scheduling.minNoticeMin || 120)

    let slots = buildSlotsForDate({ dateISO: date, timeZone: tz, workingBlocks: blocks, durationMin, bufferMin, minNoticeMin })

    // remove busy via Google
    const calIds = user.scheduling.selectedCalendarIds?.length ? user.scheduling.selectedCalendarIds : (user.google?.selectedCalendarIds || ['primary'])
    const cal = await getCalendarClient(user)
    if (cal && calIds?.length) {
      const timeMin = new Date(slots[0]?.startUtc || `${date}T00:00:00Z`).toISOString()
      const timeMax = new Date(slots[slots.length - 1]?.endUtc || `${date}T23:59:59Z`).toISOString()
      try {
        const fb = await cal.freebusy.query({ requestBody: { timeMin, timeMax, items: calIds.map(id => ({ id })) } })
        const calendars = fb.data.calendars || {}
        const busyAll = Object.values(calendars).flatMap(c => c.busy || [])
        slots = slots.filter(s => !busyAll.some(b => overlap(s.windowStartUtc, s.windowEndUtc, new Date(b.start), new Date(b.end))))
      } catch (e) { console.error('[availability] freebusy failed', e?.message || e) }
    }

    return NextResponse.json({ ok: true, slots: slotsToResponse(slots, tz) })
  } catch (e) { console.error('[availability] error', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}

function overlap(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd }
