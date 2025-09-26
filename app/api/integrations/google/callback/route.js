import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'

export const runtime = 'nodejs'

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
function getGoogleScopes() { return ['https://www.googleapis.com/auth/calendar'] }

async function getOAuth2Client(base) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${base}/api/integrations/google/callback`
  try {
    const { google } = await import('googleapis')
    if (!clientId || !clientSecret) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) {
    console.error('[Google Callback] Failed to load googleapis dynamically', e?.message || e)
    return null
  }
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect(`${base}/?google_error=missing_code_or_state`)
    }

    let uid = null
    try {
      const payload = jwt.verify(state, getJwtSecret())
      uid = payload.sub
    } catch (err) {
      return NextResponse.redirect(`${base}/?google_error=invalid_state`)
    }

    const oauth = await getOAuth2Client(base)
    if (!oauth) {
      return NextResponse.redirect(`${base}/?google_error=not_configured`)
    }

    const { tokens } = await oauth.getToken(code)

    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ id: uid })

    const prev = user?.google || {}
    const googleObj = {
      refreshToken: tokens.refresh_token || prev.refreshToken || null,
      scope: tokens.scope || prev.scope || getGoogleScopes().join(' '),
      connectedAt: prev.connectedAt || new Date().toISOString(),
      lastSyncedAt: prev.lastSyncedAt || null,
      connected: true,
    }

    await database.collection('users').updateOne(
      { id: uid },
      { $set: { google: googleObj, updatedAt: new Date() } }
    )

    return NextResponse.redirect(`${base}/?google_connected=1`)
  } catch (e) {
    console.error('google/callback error', e)
    return NextResponse.redirect(`${base}/?google_error=token_exchange_failed`)
  }
}