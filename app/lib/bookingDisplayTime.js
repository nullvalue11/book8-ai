/**
 * BOO-86B: Format stored UTC booking instants in the business IANA timezone for dashboard UI.
 */

import { formatInTimeZone } from 'date-fns-tz'

export const DEFAULT_BUSINESS_TIMEZONE = 'America/Toronto'

let warnedMissingTimezone = false

export function resolveBusinessTimezone(businessLike) {
  const raw = businessLike?.timezone
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (!warnedMissingTimezone) {
    warnedMissingTimezone = true
    console.warn('[BOO-86B] business.timezone missing; defaulting to', DEFAULT_BUSINESS_TIMEZONE)
  }
  return DEFAULT_BUSINESS_TIMEZONE
}

export function resolveBusinessTimezoneFromOwnedList(ownedBusinesses, primaryBusinessId) {
  if (!Array.isArray(ownedBusinesses) || ownedBusinesses.length === 0) {
    return DEFAULT_BUSINESS_TIMEZONE
  }
  const b = primaryBusinessId
    ? ownedBusinesses.find((x) => x.businessId === primaryBusinessId) || ownedBusinesses[0]
    : ownedBusinesses[0]
  return resolveBusinessTimezone(b)
}

/**
 * @param {string|Date|null|undefined} isoUtc
 * @param {string} [timeZone]
 */
export function formatBookingDashboardDateTime(isoUtc, timeZone) {
  const tz = timeZone || DEFAULT_BUSINESS_TIMEZONE
  if (isoUtc == null || isoUtc === '') return '—'
  try {
    const d = typeof isoUtc === 'string' || typeof isoUtc === 'number' ? new Date(isoUtc) : isoUtc
    if (Number.isNaN(d.getTime())) return '—'
    return formatInTimeZone(d, tz, 'EEE, MMM d, h:mm a')
  } catch {
    return '—'
  }
}

/**
 * Analytics series uses YYYY-MM-DD bucket strings (UTC). Label them in the business timezone.
 * Noon UTC avoids DST edge cases for the calendar day.
 *
 * @param {string} dayDateStr
 * @param {string} [timeZone]
 */
export function formatAnalyticsChartDayLabel(dayDateStr, timeZone) {
  const tz = timeZone || DEFAULT_BUSINESS_TIMEZONE
  if (!dayDateStr || typeof dayDateStr !== 'string') return '—'
  const dayPart = dayDateStr.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayPart)) {
    try {
      return formatInTimeZone(new Date(dayDateStr), tz, 'MMM d')
    } catch {
      return dayDateStr
    }
  }
  try {
    const d = new Date(`${dayPart}T12:00:00.000Z`)
    if (Number.isNaN(d.getTime())) return dayDateStr
    return formatInTimeZone(d, tz, 'MMM d')
  } catch {
    return dayDateStr
  }
}
