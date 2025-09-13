export function getBaseUrl(hostFromHeader) {
  // Prefer explicit env for prod; fall back to request Host for previews/local
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '')
  }
  if (hostFromHeader) {
    const protocol = hostFromHeader.includes('localhost') ? 'http' : 'https'
    return `${protocol}://${hostFromHeader}`
  }
  return 'http://localhost:3000'
}