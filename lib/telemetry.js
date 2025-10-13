/**
 * Telemetry and logging utility
 */

const TELEMETRY_ENABLED = process.env.NODE_ENV === 'production'

/**
 * Log telemetry event
 * @param {string} event - Event name
 * @param {object} data - Event data
 * @param {string} level - Log level (info, warn, error)
 */
export function logTelemetry(event, data = {}, level = 'info') {
  const timestamp = new Date().toISOString()
  const logEntry = {
    timestamp,
    event,
    level,
    ...data
  }
  
  // In production, send to logging service
  // For now, console log with structured format
  if (level === 'error') {
    console.error('[TELEMETRY]', JSON.stringify(logEntry))
  } else if (level === 'warn') {
    console.warn('[TELEMETRY]', JSON.stringify(logEntry))
  } else {
    console.log('[TELEMETRY]', JSON.stringify(logEntry))
  }
  
  // Could send to external service here
  // e.g., Datadog, New Relic, custom analytics
}

/**
 * Log booking events
 */
export const BookingTelemetry = {
  created: (bookingId, source, userEmail) => 
    logTelemetry('booking.created', { bookingId, source, userEmail }),
  
  rescheduled: (bookingId, guestEmail, rescheduleCount) =>
    logTelemetry('booking.rescheduled', { bookingId, guestEmail, rescheduleCount }),
  
  canceled: (bookingId, reason) =>
    logTelemetry('booking.canceled', { bookingId, reason }),
  
  reminderSent: (bookingId, type) =>
    logTelemetry('booking.reminder_sent', { bookingId, type })
}

/**
 * Log rate limiting events
 */
export const RateLimitTelemetry = {
  exceeded: (key, type, ip) =>
    logTelemetry('rate_limit.exceeded', { key, type, ip }, 'warn'),
  
  blocked: (key, type, ip) =>
    logTelemetry('rate_limit.blocked', { key, type, ip }, 'error')
}

/**
 * Log error events
 */
export function logError(error, context = {}) {
  logTelemetry('error', {
    message: error.message,
    stack: error.stack,
    ...context
  }, 'error')
}
