import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { google } from 'googleapis'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'

function getJwtSecret() {
  return process.env.JWT_SECRET || 'dev-secret-change-me'
}

function getGoogleScopes() {
  return ['https://www.googleapis.com/auth/calendar']
}

function getOAuth2Client(base) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${base}/api/integrations/google/callback`
  
  console.log('[Google OAuth Config] Base URL:', base)
  console.log('[Google OAuth Config] Client ID present:', !!clientId)
  console.log('[Google OAuth Config] Client ID length:', clientId?.length || 0)
  console.log('[Google OAuth Config] Client Secret present:', !!clientSecret)
  console.log('[Google OAuth Config] Client Secret length:', clientSecret?.length || 0)
  console.log('[Google OAuth Config] Redirect URI:', redirectUri)
  
  if (!clientId || !clientSecret) {
    console.error('[Google OAuth Config] Missing required environment variables')
    return null
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    console.log('[Google Auth] Starting auth flow, base URL:', base)
    
    // Accept jwt in query OR Authorization header
    const url = new URL(request.url)
    const jwtParam = url.searchParams.get('jwt') || url.searchParams.get('token')
    console.log('[Google Auth] JWT from query param:', jwtParam ? 'present' : 'missing')

    let userId = null
    if (jwtParam) {
      try { 
        const payload = jwt.verify(jwtParam, getJwtSecret())
        userId = payload.sub
        console.log('[Google Auth] JWT verified, userId:', userId)
      } catch (err) {
        console.error('[Google Auth] JWT verification failed:', err.message)
      }
    }
    if (!userId) {
      const authHeader = request.headers.get('authorization') || ''
      console.log('[Google Auth] Auth header:', authHeader ? 'present' : 'missing')
      if (authHeader.startsWith('Bearer ')) {
        try { 
          const payload = jwt.verify(authHeader.slice(7), getJwtSecret())
          userId = payload.sub
          console.log('[Google Auth] Auth header JWT verified, userId:', userId)
        } catch (err) {
          console.error('[Google Auth] Auth header JWT verification failed:', err.message)
        }
      }
    }

    console.log('[Google Auth] Final userId:', userId)
    
    const oauth = getOAuth2Client(base)
    console.log('[Google Auth] OAuth client created:', !!oauth)
    if (!oauth) {
      console.error('[Google Auth] OAuth client creation failed - missing env vars?')
      return NextResponse.redirect(`${base}/?google_error=not_configured`)
    }
    if (!userId) {
      console.error('[Google Auth] No userId found - JWT token missing or invalid')
      return NextResponse.redirect(`${base}/?google_error=auth_required`)
    }

    const state = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '10m' })
    const authUrl = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: getGoogleScopes(), state })
    console.log('[Google Auth] Redirecting to Google OAuth URL')
    return NextResponse.redirect(authUrl)
  } catch (e) {
    console.error('google/auth error', e)
    return NextResponse.redirect(`${base}/?google_error=server_error`)
  }
}