/**
 * Restricted CORS for sensitive API routes (not public embeddable widgets).
 * Public /api/public/** routes may still use * where needed.
 */

import { env } from './env.js'

const STATIC_ALLOW = ['https://www.book8.io', 'https://book8.io']

function collectAllowedOrigins() {
  const out = [...STATIC_ALLOW]
  if (env.IS_DEVELOPMENT) {
    out.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }
  const base = env.BASE_URL
  if (base) {
    try {
      const o = new URL(base).origin
      if (!out.includes(o)) out.push(o)
    } catch {
      /* ignore invalid */
    }
  }
  return out
}

const ALLOWED_ORIGINS = collectAllowedOrigins()

/**
 * @param {Request} request
 * @returns {string} Value for Access-Control-Allow-Origin
 */
export function getCorsAllowOrigin(request) {
  const origin = request.headers.get('origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin
  return ALLOWED_ORIGINS[0] || 'https://www.book8.io'
}

/**
 * @param {Request} request
 * @param {Record<string, string>} [extra]
 */
export function corsHeaders(request, extra = {}) {
  const allow = getCorsAllowOrigin(request)
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': extra['Access-Control-Allow-Methods'] || 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      extra['Access-Control-Allow-Headers'] || 'Content-Type, Authorization',
    ...extra
  }
}
