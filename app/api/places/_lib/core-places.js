import { env } from '@/lib/env'

/** Core API origin for Places proxy — use `CORE_API_URL` (Vercel / BOO-100B convention). */
export function corePlacesBaseUrl() {
  return (env.CORE_API_URL || '').replace(/\/$/, '')
}

export function corePlacesConfigured() {
  const base = corePlacesBaseUrl()
  const secret = env.CORE_API_INTERNAL_SECRET || ''
  return !!(base && secret)
}

export function corePlacesInternalHeaders(json = false) {
  const secret = env.CORE_API_INTERNAL_SECRET || ''
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(secret ? { 'x-book8-internal-secret': secret } : {})
  }
}
