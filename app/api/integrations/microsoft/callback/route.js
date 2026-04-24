import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'
import { env } from '@/lib/env'
import { decodeEmailFromIdToken } from '@/lib/microsoft-calendar'
import { syncCalendarToCore } from '@/lib/sync-calendar-to-core'

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

function getJwtSecret() {
  return env.JWT_SECRET
}

function getMicrosoftScopes() {
  return 'openid profile email offline_access Calendars.ReadWrite User.Read'
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return NextResponse.redirect(`${base}/?microsoft_error=missing_code_or_state`)
    }

    let uid = null
    let businessId = null
    let returnTo = null
    try {
      const payload = jwt.verify(state, getJwtSecret())
      uid = payload.sub
      businessId = payload.businessId || null
      returnTo = payload.returnTo || null
    } catch {
      return NextResponse.redirect(`${base}/?microsoft_error=invalid_state`)
    }

    if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET) {
      return NextResponse.redirect(`${base}/?microsoft_error=not_configured`)
    }

    // Use 'common' to support both org and personal Microsoft accounts (e.g. live.ca, outlook.com)
    const tenantId = 'common'
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const redirectUri = `${base}/api/integrations/microsoft/callback`

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.AZURE_AD_CLIENT_ID,
        client_secret: env.AZURE_AD_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: getMicrosoftScopes()
      })
    })

    const tokens = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || tokens.error) {
      console.error('[Microsoft Callback] token exchange failed:', tokens?.error, tokens?.error_description)
      return NextResponse.redirect(`${base}/?microsoft_error=token_exchange_failed`)
    }

    const database = await connectToMongo()
    const user = await database.collection('users').findOne({ id: uid })
    const prev = user?.microsoft || {}

    const decodedEmail = decodeEmailFromIdToken(tokens.id_token) || prev.email || user?.email || null

    const microsoftObj = {
      refreshToken: tokens.refresh_token || prev.refreshToken || null,
      email: decodedEmail,
      scope: tokens.scope || prev.scope || getMicrosoftScopes(),
      connectedAt: prev.connectedAt || new Date().toISOString(),
      connected: true,
      calendarConnected: true,
      needsReconnect: false,
      lastSyncedAt: prev.lastSyncedAt || new Date().toISOString()
    }

    if (!tokens.refresh_token && prev.refreshToken) {
      console.info('[Microsoft Callback] Preserving existing refresh_token (Microsoft did not return new one)')
    }

    await database.collection('users').updateOne(
      { id: uid },
      { $set: { microsoft: microsoftObj, updatedAt: new Date() } }
    )

    if (businessId) {
      const connectedAt = new Date().toISOString()
      const updateResult = await database.collection('businesses').updateOne(
        { businessId, ownerUserId: uid },
        {
          $set: {
            calendar: {
              connected: true,
              connectedAt,
              provider: 'microsoft',
              calendarId: decodedEmail || null
            },
            updatedAt: new Date()
          }
        }
      )

      if (updateResult.matchedCount > 0) {
        console.info(`[Microsoft Callback] Updated business ${businessId} with calendar connection`)
        try {
          await syncCalendarToCore({
            businessId,
            connected: true,
            provider: 'microsoft',
            connectedAt,
            calendarId: decodedEmail || null,
            lastSyncedAt: microsoftObj.lastSyncedAt || null
          })
        } catch (syncErr) {
          console.warn('[Microsoft Callback] syncCalendarToCore failed (non-blocking):', syncErr?.message || syncErr)
        }
        const redirectUrl = returnTo || `${base}/dashboard/business?outlook_connected=1&businessId=${businessId}`
        return NextResponse.redirect(redirectUrl)
      }

      console.warn(`[Microsoft Callback] Business ${businessId} not found for user ${uid}`)
      return NextResponse.redirect(`${base}/dashboard/business?outlook_connected=1&warning=business_not_updated`)
    }

    return NextResponse.redirect(`${base}/dashboard/integrations/calendar?connected=1&provider=microsoft`)
  } catch (e) {
    console.error('[Microsoft Callback] error', e)
    return NextResponse.redirect(`${base}/?microsoft_error=server_error`)
  }
}

