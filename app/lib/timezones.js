/**
 * IANA timezone helpers for business settings and onboarding.
 */

/** North American zones shown first with friendly labels */
export const PRIORITY_TIMEZONES = [
  { value: 'America/Toronto', label: 'Eastern — Toronto' },
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Winnipeg', label: 'Central — Winnipeg' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Edmonton', label: 'Mountain — Edmonton' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Vancouver', label: 'Pacific — Vancouver' },
  { value: 'America/Halifax', label: 'Atlantic — Halifax' },
  { value: 'America/St_Johns', label: 'Newfoundland — St. John\'s' }
]

export function isValidIanaTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false
  const s = tz.trim()
  if (!s) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: s })
    return true
  } catch {
    return false
  }
}

export function getAllIanaTimeZones() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      // fall through
    }
  }
  return PRIORITY_TIMEZONES.map((p) => p.value)
}

/** Priority list first (deduped), then remaining IANA zones sorted */
export function getOrderedTimeZoneIds() {
  const priority = PRIORITY_TIMEZONES.map((p) => p.value)
  const all = getAllIanaTimeZones()
  const set = new Set(priority)
  const rest = all.filter((z) => !set.has(z)).sort((a, b) => a.localeCompare(b))
  return [...priority, ...rest]
}

export function timeZoneLabel(iana) {
  const hit = PRIORITY_TIMEZONES.find((p) => p.value === iana)
  if (hit) return `${hit.label} (${iana})`
  return iana
}
