/**
 * Microsoft / Outlook Calendar helpers
 *
 * Token refresh + small transform helpers used by internal calendar endpoints.
 */

import { env } from '@/lib/env'

function tokenUrl() {
  const tenantId = env.AZURE_AD_TENANT_ID || 'common'
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
}

function getOAuthScopes() {
  // Keep in sync with the initial OAuth authorize request.
  return 'openid profile email offline_access Calendars.ReadWrite User.Read'
}

export function decodeEmailFromIdToken(idToken) {
  if (!idToken) return null
  try {
    // We don't verify signature here; this is only for extracting a best-effort email for bookkeeping.
    const decoded = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'))
    return (
      decoded.preferred_username ||
      decoded.upn ||
      decoded.email ||
      decoded.unique_name ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Refresh a Microsoft access token from a stored refresh token.
 * Microsoft may rotate the refresh token; if it does, return the new one.
 */
export async function getMicrosoftAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Missing Microsoft refresh token')
  }
  if (!env.AZURE_AD_CLIENT_ID || !env.AZURE_AD_CLIENT_SECRET) {
    throw new Error('Missing AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET')
  }

  const response = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.AZURE_AD_CLIENT_ID,
      client_secret: env.AZURE_AD_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: getOAuthScopes()
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.error) {
    const msg = data.error_description || data.error || 'Microsoft token refresh failed'
    throw new Error(msg)
  }

  if (!data.access_token) {
    throw new Error('Microsoft token refresh response missing access_token')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null
  }
}

