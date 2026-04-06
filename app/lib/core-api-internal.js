/**
 * Shared headers for server-to-server calls to book8-core-api.
 * Must match patterns used by sync-to-core and provision routes so all env variants work on Vercel.
 */

import { env } from './env'

export function getCoreApiBaseUrl() {
  return (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')
}

/**
 * @returns {Record<string, string>}
 */
export function getCoreApiInternalHeadersJson() {
  const apiKey = env.BOOK8_CORE_API_KEY || ''
  const internalSecret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''
  const h = {
    'Content-Type': 'application/json'
  }
  if (apiKey) {
    h['x-book8-api-key'] = apiKey
  }
  if (internalSecret) {
    h['x-book8-internal-secret'] = internalSecret
    h['x-internal-secret'] = internalSecret
  }
  return h
}

export function hasCoreApiInternalCredentials() {
  return !!(env.BOOK8_CORE_API_KEY || env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET)
}
