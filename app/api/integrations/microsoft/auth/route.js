import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'
import { env } from '@/lib/env'
import { isSubscribed } from '@/lib/subscription'

export const runtime = 'nodejs'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function getJwtSecret() {
  return env.JWT_SECRET || 'dev-secret-change-me'
}

function getMicrosoftScopes() {
  return 'openid profile email offline_access Calendars.ReadWrite User.Read'
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    const url = new URL(request.url)
    const jwtParam = url.searchParams.get('jwt') || url.searchParams.get('token')
    const businessId = url.searchParams.get('businessId')

    let userId = null
    if (jwtParam) {
      try {
        const payload = jwt.verify(jwtParam, getJwtSecret())
        userId = payload.sub
      } catch (err) {
        console.error('[Microsoft OAuth] JWT (query) verification failed:', err.message)
      }
    }

    if (!userId) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        try {
          const payload = jwt.verify(authHeader.slice(7), getJwtSecret())
          userId = payload.sub
        } catch (err) {
          console.error('[Microsoft OAuth] JWT (header) verification failed:', err.message)
        }
      }
    }

    if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET) {
      return NextResponse.redirect(`${base}/?microsoft_error=not_configured`)
    }

    if (!userId) {
      return NextResponse.redirect(`${base}/?microsoft_error=auth_required`)
    }

    const database = await connect()
    const user = await database.collection('users').findOne({ id: userId })

    if (!user) {
      return NextResponse.redirect(`${base}/?microsoft_error=user_not_found`)
    }

    if (businessId) {
      const business = await database.collection('businesses').findOne({
        businessId,
        ownerUserId: userId
      })

      if (!business) {
        console.log(`[Microsoft Auth] Business ${businessId} not found or not owned by user ${userId}`)
        return NextResponse.redirect(`${base}/dashboard/business?error=business_not_found`)
      }

      if (business.subscription?.status !== 'active') {
        console.log(`[Microsoft Auth] Business ${businessId} has no active subscription`)
        return NextResponse.redirect(`${base}/dashboard/business?error=subscription_required&businessId=${businessId}`)
      }
    } else {
      // User-context calendar connections (legacy behavior)
      if (!isSubscribed(user)) {
        console.log(`[Microsoft OAuth] User ${userId} blocked - no active subscription`)
        const acceptHeader = request.headers.get('accept') || ''
        if (acceptHeader.includes('application/json')) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Subscription required',
              code: 'SUBSCRIPTION_REQUIRED',
              feature: 'calendar',
              message: 'An active subscription is required to connect Outlook Calendar. Please subscribe at /pricing'
            },
            { status: 402 }
          )
        }
        return NextResponse.redirect(`${base}/pricing?paywall=1&feature=calendar`)
      }
    }

    const statePayload = { sub: userId }
    if (businessId) statePayload.businessId = businessId

    const state = jwt.sign(statePayload, getJwtSecret(), { expiresIn: '10m' })
    const redirectUri = `${base}/api/integrations/microsoft/callback`

    const tenantId = env.AZURE_AD_TENANT_ID || 'common'
    const scopes = getMicrosoftScopes()

    const authorizeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(env.AZURE_AD_CLIENT_ID)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_mode=query` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&state=${encodeURIComponent(state)}` +
      `&prompt=consent` +
      `&login_hint=${encodeURIComponent(user.email || '')}`

    return NextResponse.redirect(authorizeUrl)
  } catch (e) {
    console.error('[Microsoft OAuth] auth error', e)
    return NextResponse.redirect(`${base}/?microsoft_error=server_error`)
  }
}

