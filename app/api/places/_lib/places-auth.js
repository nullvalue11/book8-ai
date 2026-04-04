import { env } from '@/lib/env'

export async function verifyPlacesBearer(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Authentication required', status: 401, userId: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const sub = typeof payload.sub === 'string' ? payload.sub : null
    if (!sub) return { error: 'Invalid token', status: 401, userId: null }
    return { error: null, status: 200, userId: sub }
  } catch {
    return { error: 'Invalid or expired token', status: 401, userId: null }
  }
}
