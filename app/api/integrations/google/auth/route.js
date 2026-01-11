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

function getGoogleScopes() {
  return ['https://www.googleapis.com/auth/calendar']
}

async function getOAuth2Client(base) {
  const clientId = env.GOOGLE?.CLIENT_ID
  const clientSecret = env.GOOGLE?.CLIENT_SECRET
  const redirectUri = env.GOOGLE?.REDIRECT_URI || `${base}/api/integrations/google/callback`
  try {
    const { google } = await import('googleapis')
    if (!clientId || !clientSecret) return null
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  } catch (e) {
    console.error('[Google OAuth] Failed to load googleapis dynamically', e?.message || e)
    return null
  }
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    // Accept jwt in query OR Authorization header
    const url = new URL(request.url)
    const jwtParam = url.searchParams.get('jwt') || url.searchParams.get('token')
    
    // Optional: businessId for business-context calendar connections
    const businessId = url.searchParams.get('businessId')

    let userId = null
    if (jwtParam) {
      try {
        const payload = jwt.verify(jwtParam, getJwtSecret())
        userId = payload.sub
      } catch (err) {
        console.error('[Google Auth] JWT (query) verification failed:', err.message)
      }
    }
    if (!userId) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        try {
          const payload = jwt.verify(authHeader.slice(7), getJwtSecret())
          userId = payload.sub
        } catch (err) {
          console.error('[Google Auth] JWT (header) verification failed:', err.message)
        }
      }
    }

    const oauth = await getOAuth2Client(base)
    if (!oauth) {
      return NextResponse.redirect(`${base}/?google_error=not_configured`)
    }
    if (!userId) {
      return NextResponse.redirect(`${base}/?google_error=auth_required`)
    }

    const database = await connect()
    const user = await database.collection('users').findOne({ id: userId })
    
    if (!user) {
      return NextResponse.redirect(`${base}/?google_error=user_not_found`)
    }
    
    // If businessId is provided, validate ownership and check business subscription
    if (businessId) {
      const business = await database.collection('businesses').findOne({ 
        businessId, 
        ownerUserId: userId 
      })
      
      if (!business) {
        console.log(`[Google Auth] Business ${businessId} not found or not owned by user ${userId}`)
        return NextResponse.redirect(`${base}/dashboard/business?error=business_not_found`)
      }
      
      // For business calendar connections, check business subscription
      if (business.subscription?.status !== 'active') {
        console.log(`[Google Auth] Business ${businessId} has no active subscription`)
        return NextResponse.redirect(`${base}/dashboard/business?error=subscription_required&businessId=${businessId}`)
      }
    } else {
      // For non-business calendar connections, check user subscription (legacy behavior)
      if (!isSubscribed(user)) {
        console.log(`[Google Auth] User ${userId} blocked - no active subscription`)
        
        // Return JSON for API/fetch requests, redirect for browser
        const acceptHeader = request.headers.get('accept') || ''
        if (acceptHeader.includes('application/json')) {
          return NextResponse.json({
            ok: false,
            error: 'Subscription required',
            code: 'SUBSCRIPTION_REQUIRED',
            feature: 'calendar',
            message: 'An active subscription is required to connect Google Calendar. Please subscribe at /pricing'
          }, { status: 402 })
        }
        
        return NextResponse.redirect(`${base}/pricing?paywall=1&feature=calendar`)
      }
    }

    // Include businessId in state if provided
    const statePayload = { sub: userId }
    if (businessId) {
      statePayload.businessId = businessId
    }
    
    const state = jwt.sign(statePayload, getJwtSecret(), { expiresIn: '10m' })
    const authUrl = oauth.generateAuthUrl({ 
      access_type: 'offline', 
      prompt: 'consent',  // Force consent to get refresh token
      scope: getGoogleScopes(), 
      state 
    })
    return NextResponse.redirect(authUrl)
  } catch (e) {
    console.error('google/auth error', e)
    return NextResponse.redirect(`${base}/?google_error=server_error`)
  }
}