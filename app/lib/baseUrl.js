import { env } from '@/lib/env'

export function getBaseUrl(hostFromHeader) {
  // Prefer explicit env for prod; fall back to request Host for previews/local
  if (env.BASE_URL) {
    return env.BASE_URL.replace(/\/$/, '')
  }
  if (hostFromHeader) {
    const protocol = hostFromHeader.includes('localhost') ? 'http' : 'https'
    return `${protocol}://${hostFromHeader}`
  }
  return 'http://localhost:3000'
}