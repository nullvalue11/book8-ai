import jwt from 'jsonwebtoken'
import { env } from '../env'

const RESCHEDULE_TOKEN_EXPIRY = '48h'

/**
 * Generate a signed reschedule token
 * @param {string} bookingId - The booking ID
 * @param {string} guestEmail - Guest email address
 * @returns {string} Signed JWT token
 */
export function generateRescheduleToken(bookingId, guestEmail) {
  const payload = {
    bookingId,
    guestEmail,
    type: 'reschedule',
    nonce: Math.random().toString(36).substring(2, 15)
  }
  
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: RESCHEDULE_TOKEN_EXPIRY })
}

/**
 * Verify and decode a reschedule token
 * @param {string} token - JWT token to verify
 * @returns {object} Object with valid boolean and payload/error
 */
export function verifyRescheduleToken(token) {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET)
    
    if (decoded.type !== 'reschedule') {
      return { valid: false, error: 'Invalid token type' }
    }
    
    return { valid: true, payload: decoded }
  } catch (error) {
    console.error('[rescheduleToken] Verification failed:', error.message)
    return { valid: false, error: error.message }
  }
}
