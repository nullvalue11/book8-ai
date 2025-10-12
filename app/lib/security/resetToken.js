import crypto from 'crypto'
import jwt from 'jsonwebtoken'

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function randomNonce(len = 16) { return b64url(crypto.randomBytes(len)) }

export function signResetToken({ sub, purpose = 'password_reset', ttlMinutes = 30, extra = {} }) {
  const secret = process.env.RESET_TOKEN_SECRET
  if (!secret) throw new Error('RESET_TOKEN_SECRET missing')
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.max(1, Math.floor(ttlMinutes)) * 60
  const nonce = randomNonce(16)
  const payload = { sub, iat: now, exp, purpose, nonce, ...extra }
  const token = jwt.sign(payload, secret, { algorithm: 'HS256' })
  return { token, payload }
}

export function verifyResetToken(token) {
  return verifyActionToken(token, 'password_reset')
}

export function signActionToken({ sub, purpose, ttlMinutes = 30, extra = {} }) {
  if (!purpose) throw new Error('purpose required')
  return signResetToken({ sub, purpose, ttlMinutes, extra })
}

export function verifyActionToken(token, expectedPurpose) {
  const secret = process.env.RESET_TOKEN_SECRET
  if (!secret) throw new Error('RESET_TOKEN_SECRET missing')
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (expectedPurpose && payload.purpose !== expectedPurpose) throw new Error('Invalid purpose')
    return { valid: true, payload }
  } catch (e) { return { valid: false, error: e } }
}

export function ttlMinutes() {
  const n = parseInt(process.env.RESET_TOKEN_TTL_MINUTES || '30', 10)
  return isNaN(n) ? 30 : Math.max(5, Math.min(n, 120))
}
