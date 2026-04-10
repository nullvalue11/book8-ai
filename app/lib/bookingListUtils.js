/**
 * BOO-87B: Shared parsing and filters for dashboard booking lists (core-api + Mongo shapes).
 */

/**
 * @param {object | null | undefined} booking
 * @returns {number | null} epoch ms, or null if unparseable
 */
export function getBookingStartMs(booking) {
  if (!booking || typeof booking !== 'object') return null
  const slot = booking.slot
  let raw =
    slot?.start ??
    booking.startTime ??
    booking.start ??
    booking.slotStart
  if (raw == null && slot && typeof slot.start === 'object' && slot.start !== null) {
    raw = slot.start.dateTime || slot.start.date_time || slot.start
  }
  if (raw == null) return null
  const d = new Date(raw)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

export function isCancelledBooking(booking) {
  const s = booking?.status != null ? String(booking.status).toLowerCase().trim() : ''
  return s === 'canceled' || s === 'cancelled'
}

/**
 * Upcoming = slot in the future (UTC), not cancelled.
 * BOO-87B: include pending, booked, confirmed, etc. — only exclude cancelled.
 */
export function isUpcomingBooking(booking, nowMs = Date.now()) {
  if (isCancelledBooking(booking)) return false
  const t = getBookingStartMs(booking)
  if (t == null) return false
  return t >= nowMs
}

/**
 * Recent past window: last 14 days, not cancelled.
 */
export function isRecentPastBooking(booking, nowMs, pastCutoffMs) {
  if (isCancelledBooking(booking)) return false
  const t = getBookingStartMs(booking)
  if (t == null) return false
  return t < nowMs && t >= pastCutoffMs
}
