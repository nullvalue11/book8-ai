import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

let client
let db

async function connectToMongo() {
  if (!client) {
    if (!process.env.MONGO_URL) throw new Error('MONGO_URL missing')
    if (!process.env.DB_NAME) throw new Error('DB_NAME missing')
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function getJwtSecret() { return process.env.JWT_SECRET || 'dev-secret-change-me' }

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
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI
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
    const calendar = await getCalendarClientForUser(user)
    if (!calendar) return NextResponse.json({ ok: false, error: 'Google not connected' }, { status: 400 })

    const resp = await calendar.calendarList.list()
    const items = resp.data.items || []
    const mapped = items.map(x => ({ id: x.id, summary: x.summary, accessRole: x.accessRole, primary: !!x.primary }))
    return NextResponse.json({ ok: true, calendars: mapped })
  } catch (e) {
    console.error('[google/calendars] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
