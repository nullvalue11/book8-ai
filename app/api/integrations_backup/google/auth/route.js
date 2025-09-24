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
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function GET(request) {
  const base = getBaseUrl(headers().get('host') || undefined)
  try {
    // Accept jwt in query OR Authorization header
    const url = new URL(request.url)
    const jwtParam = url.searchParams.get('jwt') || url.searchParams.get('token')

    let userId = null
    if (jwtParam) {
      try { const payload = jwt.verify(jwtParam, getJwtSecret()); userId = payload.sub } catch {}
    }
    if (!userId) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        try { const payload = jwt.verify(authHeader.slice(7), getJwtSecret()); userId = payload.sub } catch {}
      }
    }

    const oauth = getOAuth2Client(base)
    if (!oauth) return NextResponse.redirect(`${base}/?google_error=not_configured`)
    if (!userId) return NextResponse.redirect(`${base}/?google_error=auth_required`)

    const state = jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: '10m' })
    const authUrl = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: getGoogleScopes(), state })
    return NextResponse.redirect(authUrl)
  } catch (e) {
    console.error('google/auth error', e)
    return NextResponse.redirect(`${base}/?google_error=server_error`)
  }
}