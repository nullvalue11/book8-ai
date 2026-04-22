/**
 * BOO-112B — Single place to build Google Calendar OAuth start URLs so `businessId`
 * is not dropped when linking from business context.
 *
 * Server and client safe (no Node-only APIs). CommonJS so Jest can require it.
 */

'use strict'

/** Escape hatch: link Google to the user account only; callback skips business.calendar update. */
const GOOGLE_OAUTH_USER_CONNECT_PURPOSE = 'user_connect'

/**
 * @param {{ jwt: string, businessId?: string | null, returnTo?: string | null, purpose?: string | null }} opts
 * @returns {string} Relative URL `/api/integrations/google/auth?...`
 */
function buildGoogleConnectUrl({ jwt, businessId, returnTo, purpose } = {}) {
  if (!jwt || typeof jwt !== 'string') {
    throw new Error('buildGoogleConnectUrl: jwt required')
  }
  const params = new URLSearchParams({ jwt })
  if (businessId && String(businessId).trim()) {
    params.set('businessId', String(businessId).trim())
  }
  if (returnTo && String(returnTo).trim()) {
    params.set('returnTo', String(returnTo).trim())
  }
  if (purpose && String(purpose).trim()) {
    params.set('purpose', String(purpose).trim())
  }
  return `/api/integrations/google/auth?${params.toString()}`
}

/**
 * Auth route guard: allow starting OAuth only with a business scope or explicit user-only purpose.
 * @param {{ businessId?: string | null, purpose?: string | null }} q
 * @returns {{ allowed: true } | { allowed: false, body: object }}
 */
function validateGoogleAuthEntryQuery({ businessId, purpose }) {
  const hasBid = !!(businessId && String(businessId).trim())
  if (hasBid) return { allowed: true }
  if (purpose === GOOGLE_OAUTH_USER_CONNECT_PURPOSE) return { allowed: true }
  return {
    allowed: false,
    body: {
      ok: false,
      error:
        'businessId is required to connect Google Calendar for a business. Open Connect from your business dashboard, or pass purpose=user_connect for a user-only link (no business calendar flag).',
      code: 'BUSINESS_ID_OR_PURPOSE_REQUIRED'
    }
  }
}

module.exports = {
  GOOGLE_OAUTH_USER_CONNECT_PURPOSE,
  buildGoogleConnectUrl,
  validateGoogleAuthEntryQuery
}
