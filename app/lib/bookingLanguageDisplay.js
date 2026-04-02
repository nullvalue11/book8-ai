/** Small badge for dashboard bookings (BOO-33B / BOO-34B). */

const MAP = {
  en: { flag: '🇺🇸', label: 'EN' },
  fr: { flag: '🇫🇷', label: 'FR' },
  es: { flag: '🇪🇸', label: 'ES' },
  ar: { flag: '🇸🇦', label: 'AR' }
}

/** @param {string | null | undefined} code */
export function bookingLanguageBadge(code) {
  const c = String(code || 'en')
    .toLowerCase()
    .slice(0, 2)
  if (MAP[c]) return MAP[c]
  return { flag: '🌐', label: c.toUpperCase() }
}
