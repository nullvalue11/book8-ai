/**
 * book8-core-api business profile (owner PATCH + read for dashboard).
 * PATCH /api/businesses/:businessId/profile requires x-book8-user-email.
 */

import { env } from '@/lib/env'
import { getCoreApiBaseUrl, getCoreApiInternalHeadersJson } from '@/lib/core-api-internal'
import { mergedLocalProfileToCoreBusinessProfileBody } from '@/lib/businessProfile'

/**
 * @param {string} businessId
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function getCoreBusinessRecord(businessId) {
  const baseUrl = getCoreApiBaseUrl()
  if (!baseUrl) return null
  const headers = getCoreApiInternalHeadersJson()
  if (!headers['x-book8-api-key'] && !headers['x-book8-internal-secret']) return null

  try {
    const res = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    if (!data || typeof data !== 'object') return null
    return /** @type {Record<string, unknown>} */ (data.business ?? data.data ?? data)
  } catch {
    return null
  }
}

/**
 * @param {string} businessId
 * @param {string} userEmail owner session email → x-book8-user-email
 * @param {Record<string, unknown>} mergedLocalProfile normalized book8-ai businessProfile fields
 */
export async function patchCoreBusinessProfile(businessId, userEmail, mergedLocalProfile) {
  const baseUrl = getCoreApiBaseUrl()
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'Booking service is not configured (set CORE_API_BASE_URL and BOOK8_CORE_API_KEY).',
      code: 'CORE_API_NOT_CONFIGURED'
    }
  }

  const email = String(userEmail || '').trim()
  if (!email || !email.includes('@')) {
    return {
      ok: false,
      status: 400,
      error: 'Your account has no email on file; cannot save to the booking service.',
      code: 'MISSING_USER_EMAIL'
    }
  }

  const businessProfile = mergedLocalProfileToCoreBusinessProfileBody(mergedLocalProfile)
  if (Object.keys(businessProfile).length === 0) {
    return { ok: true, data: null }
  }

  const res = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-api-key': apiKey,
      'x-book8-user-email': email.slice(0, 320)
    },
    body: JSON.stringify({ businessProfile }),
    cache: 'no-store'
  })

  const text = await res.text().catch(() => '')
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      (json && typeof json === 'object' && (json.message || json.error)) ||
      (typeof json === 'string' ? json : null) ||
      text ||
      `Booking service returned ${res.status}`
    return {
      ok: false,
      status: res.status,
      error: typeof msg === 'string' ? msg : 'Save failed',
      code: json && typeof json === 'object' ? json.code : undefined,
      body: json
    }
  }

  return { ok: true, data: json }
}
