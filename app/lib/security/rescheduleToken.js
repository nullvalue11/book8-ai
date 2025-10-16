import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
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
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: RESCHEDULE_TOKEN_EXPIRY })
}

/**
 * Verify and decode a reschedule token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded payload or null if invalid
 */
export function verifyRescheduleToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    if (decoded.type !== 'reschedule') {
      return null
    }
    
    return decoded
  } catch (error) {
    console.error('[rescheduleToken] Verification failed:', error.message)
    return null
  }
}
