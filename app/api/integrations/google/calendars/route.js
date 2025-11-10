import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client
let db

async function connectToMongo() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

export async function OPTIONS() { return new Response(null, { status: 204 }) }

function getJwtSecret() { return env.JWT_SECRET || 'dev-secret-change-me' }

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { user }
  } catch { return { error: 'Invalid or expired token', status: 401 } }
}

async function getOAuth2Client() {
  try {
    const { google } = await import('googleapis')
    const clientId = env.GOOGLE?.CLIENT_ID
    const clientSecret = env.GOOGLE?.CLIENT_SECRET
    const redirectUri = env.GOOGLE?.REDIRECT_URI
    if (!clientId || !clientSecret || !redirectUri) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) {
    console.error('[google/calendars] load googleapis failed', e?.message || e)
    return null
  }
}

async function getCalendarClientForUser(user) {
  try {
    const { google } = await import('googleapis')
    const refreshToken = user?.google?.refreshToken
    if (!refreshToken) return null
    const oauth = await getOAuth2Client()
    if (!oauth) return null
    oauth.setCredentials({ refresh_token: refreshToken })
    return google.calendar({ version: 'v3', auth: oauth })
  } catch (e) {
    console.error('[google/calendars] build calendar client failed', e?.message || e)
    return null
  }
}

export async function GET(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    const user = await database.collection('users').findOne({ id: auth.user.id })
    const selectedIds = user?.google?.selectedCalendarIds || (user?.google?.selectedCalendars) || []
    const calendar = await getCalendarClientForUser(user)
    if (!calendar) return NextResponse.json({ ok: false, error: 'Google not connected' }, { status: 400 })

    const resp = await calendar.calendarList.list()
    const items = resp.data.items || []
    const calendars = items.map(x => ({ id: x.id, summary: x.summary, accessRole: x.accessRole, primary: !!x.primary, selected: Array.isArray(selectedIds) ? selectedIds.includes(x.id) || (x.primary && selectedIds.includes('primary')) : false }))

    console.info('[google/calendars] returned', calendars.length)
    return NextResponse.json({ ok: true, calendars })
  } catch (e) {
    console.error('[google/calendars] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const database = await connectToMongo()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    const body = await request.json().catch(() => ({}))
    let ids = body?.selectedCalendarIds || body?.selectedCalendars || []
    if (!Array.isArray(ids)) ids = []
    ids = ids.map(String)

    await database.collection('users').updateOne({ id: auth.user.id }, { $set: { 'google.selectedCalendarIds': ids, 'google.updatedAt': new Date() } })
    console.info('[google/calendars] saved selectedCalendarIds', ids)
    return NextResponse.json({ ok: true, selectedCalendarIds: ids })
  } catch (e) {
    console.error('[google/calendars] save error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
