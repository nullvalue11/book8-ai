import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { headers } from 'next/headers'
import { getBaseUrl } from '../../../../../lib/baseUrl'
import { env } from '@/lib/env'

export const runtime = 'nodejs'

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

    const state = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '10m' })
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