import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'
import { env } from '@/lib/env'

export const runtime = 'nodejs'

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

function getJwtSecret() { return env.JWT_SECRET || 'dev-secret-change-me' }
function getGoogleScopes() { return ['https://www.googleapis.com/auth/calendar'] }

async function getOAuth2Client(base) {
  const clientId = env.GOOGLE?.CLIENT_ID
  const clientSecret = env.GOOGLE?.CLIENT_SECRET
  const redirectUri = env.GOOGLE?.REDIRECT_URI || `${base}/api/integrations/google/callback`
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
    let businessId = null
    try {
      const payload = jwt.verify(state, getJwtSecret())
      uid = payload.sub
      businessId = payload.businessId || null  // Extract businessId if present
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
    
    // Only overwrite refresh_token if Google returns a new one
    // Don't clobber a good token with undefined
    const googleObj = {
      refreshToken: tokens.refresh_token || prev.refreshToken || null,
      scope: tokens.scope || prev.scope || getGoogleScopes().join(' '),
      connectedAt: prev.connectedAt || new Date().toISOString(),
      lastSyncedAt: prev.lastSyncedAt || null,
      connected: true,
      needsReconnect: false, // Clear any previous reconnect flag
    }
    
    // Log if we're preserving an existing token
    if (!tokens.refresh_token && prev.refreshToken) {
      console.info('[Google Callback] Preserving existing refresh_token (Google did not return new one)')
    }

    // Always update the user's Google credentials
    await database.collection('users').updateOne(
      { id: uid },
      { $set: { google: googleObj, updatedAt: new Date() } }
    )

    // If this is a business-context connection, update the business document
    if (businessId) {
      const updateResult = await database.collection('businesses').updateOne(
        { businessId, ownerUserId: uid },
        { 
          $set: { 
            calendar: {
              connected: true,
              connectedAt: new Date().toISOString(),
              provider: 'google',
            },
            updatedAt: new Date() 
          } 
        }
      )
      
      if (updateResult.matchedCount > 0) {
        console.info(`[Google Callback] Updated business ${businessId} with calendar connection`)
        return NextResponse.redirect(`${base}/dashboard/business?google_connected=1&businessId=${businessId}`)
      } else {
        console.warn(`[Google Callback] Business ${businessId} not found for user ${uid}`)
        // Still redirect to business page, calendar is connected at user level
        return NextResponse.redirect(`${base}/dashboard/business?google_connected=1&warning=business_not_updated`)
      }
    }

    return NextResponse.redirect(`${base}/?google_connected=1`)
  } catch (e) {
    console.error('google/callback error', e)
    return NextResponse.redirect(`${base}/?google_error=token_exchange_failed`)
  }
}