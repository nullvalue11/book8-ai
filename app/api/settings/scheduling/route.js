import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { DEFAULT_REMINDER_SETTINGS, normalizeReminderSettings } from '@/lib/reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client, db, indexed = false
async function connect() {
  if (!client) { client = new MongoClient(env.MONGO_URL); await client.connect(); db = client.db(env.DB_NAME) }
  if (!indexed) {
    try { await db.collection('users').createIndex({ 'scheduling.handleLower': 1 }, { unique: true, sparse: true }) } catch {}
    indexed = true
  }
  return db
}

export async function OPTIONS() { return new Response(null, { status: 204 }) }

export async function GET(request) {
  try {
    const database = await connect()
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const jwt = (await import('jsonwebtoken')).default
    let payload
    try { payload = jwt.verify(token, env.JWT_SECRET) } catch { return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }
    const u = await database.collection('users').findOne({ id: payload.sub })
    
    // Normalize reminders to new format if exists
    let scheduling = u?.scheduling || null
    if (scheduling?.reminders) {
      scheduling = {
        ...scheduling,
        reminders: normalizeReminderSettings(scheduling.reminders)
      }
    }
    
    return NextResponse.json({ ok: true, scheduling })
  } catch (e) { console.error('[settings/scheduling] GET', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}

export async function POST(request) {
  try {
    const database = await connect()
    const auth = request.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    const jwt = (await import('jsonwebtoken')).default
    let payload
    try { payload = jwt.verify(token, env.JWT_SECRET) } catch { return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) }

    const body = await request.json()
    let { handle, timeZone, workingHours, defaultDurationMin, bufferMin, minNoticeMin, selectedCalendarIds, reminders } = body || {}
    if (handle) handle = String(handle).trim().toLowerCase()

    // validate uniqueness
    if (handle) {
      const existing = await database.collection('users').findOne({ 'scheduling.handleLower': handle, id: { $ne: payload.sub } })
      if (existing) return NextResponse.json({ ok: false, error: 'Handle already in use' }, { status: 409 })
    }

    // Parse reminder settings with new structure
    // Structure: { enabled, guestEnabled, hostEnabled, types: { '24h', '1h' } }
    const reminderSettings = {
      enabled: reminders?.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
      guestEnabled: reminders?.guestEnabled ?? DEFAULT_REMINDER_SETTINGS.guestEnabled,
      hostEnabled: reminders?.hostEnabled ?? DEFAULT_REMINDER_SETTINGS.hostEnabled,
      types: {
        '24h': reminders?.types?.['24h'] ?? DEFAULT_REMINDER_SETTINGS.types['24h'],
        '1h': reminders?.types?.['1h'] ?? DEFAULT_REMINDER_SETTINGS.types['1h']
      }
    }

    const scheduling = {
      handle: handle || null,
      handleLower: handle || null,
      timeZone: timeZone || 'UTC',
      workingHours: workingHours || {
        mon: [{ start: '09:00', end: '17:00' }],
        tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }],
        thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }],
        sat: [],
        sun: []
      },
      defaultDurationMin: Number(defaultDurationMin || 30),
      bufferMin: Number(bufferMin || 0),
      minNoticeMin: Number(minNoticeMin || 120),
      selectedCalendarIds: Array.isArray(selectedCalendarIds) ? selectedCalendarIds : [],
      reminders: reminderSettings
    }

    await database.collection('users').updateOne({ id: payload.sub }, { $set: { scheduling } })
    console.info('[settings/scheduling] saved', payload.sub, scheduling.handle, 'reminders:', reminderSettings)
    return NextResponse.json({ ok: true, scheduling })
  } catch (e) { console.error('[settings/scheduling] POST', e); return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 }) }
}
