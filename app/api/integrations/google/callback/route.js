import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'

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

function getOAuth2Client(base) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${base}/api/integrations/google/callback`
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    console.log('[Google Callback] Starting callback processing, base URL:', base)
    
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    console.log('[Google Callback] Code:', code ? 'present' : 'missing')
    console.log('[Google Callback] State:', state ? 'present' : 'missing')
    
    if (!code || !state) {
      console.error('[Google Callback] Missing code or state parameters')
      return NextResponse.redirect(`${base}/?google_error=missing_code_or_state`)
    }

    let uid = null
    try { 
      const payload = jwt.verify(state, getJwtSecret())
      uid = payload.sub
      console.log('[Google Callback] State JWT verified, userId:', uid)
    } catch (err) { 
      console.error('[Google Callback] State JWT verification failed:', err.message)
      return NextResponse.redirect(`${base}/?google_error=invalid_state`)
    }

    const oauth = getOAuth2Client(base)
    if (!oauth) {
      console.error('[Google Callback] OAuth client creation failed')
      return NextResponse.redirect(`${base}/?google_error=not_configured`)
    }

    console.log('[Google Callback] Exchanging code for tokens...')
    const { tokens } = await oauth.getToken(code)
    console.log('[Google Callback] Token exchange successful, tokens received:', {
      access_token: tokens.access_token ? 'present' : 'missing',
      refresh_token: tokens.refresh_token ? 'present' : 'missing',
      scope: tokens.scope
    })
    
    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ id: uid })
    console.log('[Google Callback] User found in database:', !!user)
    
    const prev = user?.google || {}
    const googleObj = {
      refreshToken: tokens.refresh_token || prev.refreshToken || null,
      scope: tokens.scope || prev.scope || getGoogleScopes().join(' '),
      connectedAt: prev.connectedAt || new Date().toISOString(),
      lastSyncedAt: prev.lastSyncedAt || null,
      connected: true, // Add explicit connected flag
    }
    
    console.log('[Google Callback] Updating user with Google data:', googleObj)
    
    await database.collection('users').updateOne(
      { id: uid }, 
      { $set: { google: googleObj, updatedAt: new Date() } }
    )
    
    console.log('[Google Callback] User updated successfully, redirecting to success page')
    return NextResponse.redirect(`${base}/?google_connected=1`)
  } catch (e) {
    console.error('google/callback error', e)
    return NextResponse.redirect(`${base}/?google_error=token_exchange_failed`)
  }
}