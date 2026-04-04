import { env } from '@/lib/env'

export function corePlacesBaseUrl() {
  return (env.CORE_API_BASE_URL || '').replace(/\/$/, '')
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
