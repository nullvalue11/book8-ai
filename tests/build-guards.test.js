/**
 * Build Guards Test
 * Ensures critical exports exist to prevent build failures
 */

describe('Security Token Exports', () => {
  test('resetToken exports required functions', async () => {
    const resetToken = await import('../app/lib/security/resetToken.js')
    
    // Core password reset functions
    expect(typeof resetToken.signResetToken).toBe('function')
    expect(typeof resetToken.verifyResetToken).toBe('function')
    
    // Action token functions
    expect(typeof resetToken.signActionToken).toBe('function')
    expect(typeof resetToken.verifyActionToken).toBe('function')
    
    // Booking-specific helper
    expect(typeof resetToken.generateCancelToken).toBe('function')
    
    // TTL helper
    expect(typeof resetToken.ttlMinutes).toBe('function')
  })

  test('rescheduleToken exports required functions', async () => {
    const rescheduleToken = await import('../app/lib/security/rescheduleToken.js')
    
    expect(typeof rescheduleToken.generateRescheduleToken).toBe('function')
    expect(typeof rescheduleToken.verifyRescheduleToken).toBe('function')
  })

  test('generateCancelToken produces valid token', async () => {
    const { generateCancelToken, verifyActionToken } = await import('../app/lib/security/resetToken.js')
    
    const bookingId = 'test-booking-123'
    const guestEmail = 'test@example.com'
    
    const token = generateCancelToken(bookingId, guestEmail)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)
    
    // Verify token structure
    const { valid, payload } = verifyActionToken(token, 'booking_cancel')
    expect(valid).toBe(true)
    expect(payload.sub).toBe(guestEmail)
    expect(payload.bookingId).toBe(bookingId)
    expect(payload.purpose).toBe('booking_cancel')
  })

  test('generateRescheduleToken produces valid token', async () => {
    const { generateRescheduleToken, verifyRescheduleToken } = await import('../app/lib/security/rescheduleToken.js')
    
    const bookingId = 'test-booking-123'
    const guestEmail = 'test@example.com'
    
    const token = generateRescheduleToken(bookingId, guestEmail)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(20)
    
    // Verify token structure
    const decoded = verifyRescheduleToken(token)
    expect(decoded).toBeTruthy()
    expect(decoded.bookingId).toBe(bookingId)
    expect(decoded.guestEmail).toBe(guestEmail)
    expect(decoded.type).toBe('reschedule')
  })
})

describe('API Route Import Guards', () => {
  test('booking route can import all required functions', async () => {
    // This test ensures the imports in the booking route are valid
    const { generateCancelToken } = await import('../app/lib/security/resetToken.js')
    const { generateRescheduleToken } = await import('../app/lib/security/rescheduleToken.js')
    const { checkRateLimit } = await import('../app/lib/rateLimiting.js')
    const { BookingTelemetry } = await import('../app/lib/telemetry.js')
    
    expect(generateCancelToken).toBeDefined()
    expect(generateRescheduleToken).toBeDefined()
    expect(checkRateLimit).toBeDefined()
    expect(BookingTelemetry).toBeDefined()
  })

  test('reschedule confirm route can import all required functions', async () => {
    // This test ensures the imports in the reschedule confirm route are valid
    const { verifyRescheduleToken, generateRescheduleToken } = await import('../app/lib/security/rescheduleToken.js')
    const { generateCancelToken } = await import('../app/lib/security/resetToken.js')
    const { checkRateLimit } = await import('../app/lib/rateLimiting.js')
    const { BookingTelemetry } = await import('../app/lib/telemetry.js')
    
    expect(verifyRescheduleToken).toBeDefined()
    expect(generateRescheduleToken).toBeDefined()
    expect(generateCancelToken).toBeDefined()
    expect(checkRateLimit).toBeDefined()
    expect(BookingTelemetry).toBeDefined()
  })
})
