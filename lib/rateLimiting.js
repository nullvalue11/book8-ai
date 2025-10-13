// Simple in-memory rate limiting
// In production, use Redis or similar
const rateLimitStore = new Map()

/**
 * Rate limiting configuration
 */
const RATE_LIMITS = {
  publicBooking: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  reschedule: { maxRequests: 3, windowMs: 3600000 }, // 3 requests per hour
  default: { maxRequests: 100, windowMs: 60000 } // 100 requests per minute
}

/**
 * Check if a request should be rate limited
 * @param {string} key - Unique identifier (IP, email, etc.)
 * @param {string} type - Type of rate limit to apply
 * @returns {object} { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(key, type = 'default') {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default
  const now = Date.now()
  const limitKey = `${type}:${key}`
  
  // Get or create rate limit entry
  if (!rateLimitStore.has(limitKey)) {
    rateLimitStore.set(limitKey, {
      requests: [],
      resetAt: now + config.windowMs
    })
  }
  
  const entry = rateLimitStore.get(limitKey)
  
  // Remove expired requests
  entry.requests = entry.requests.filter(time => time > now - config.windowMs)
  
  // Check if limit exceeded
  if (entry.requests.length >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt
    }
  }
  
  // Add new request
  entry.requests.push(now)
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.requests.length,
    resetAt: entry.resetAt
  }
}

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now && entry.requests.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}, 300000) // Clean up every 5 minutes
