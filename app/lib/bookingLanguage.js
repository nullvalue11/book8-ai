/** Supported languages for booking confirmation emails (match core-api / BOO-33). */

const SUPPORTED = ['en', 'fr', 'es', 'ar']

export function detectLanguageFromRequest(request) {
  if (!request?.headers?.get) return 'en'
  const acceptLang = request.headers.get('accept-language') || ''
  const primary = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase()?.trim()
  return SUPPORTED.includes(primary) ? primary : 'en'
}

export function normalizeBookingLanguage(raw) {
  if (raw == null || typeof raw !== 'string') return 'en'
  const primary = raw.toLowerCase().trim().slice(0, 2)
  return SUPPORTED.includes(primary) ? primary : 'en'
}

/** Prefer explicit `language` from booking body; otherwise Accept-Language. */
export function resolveBookingLanguage(request, bodyLanguage) {
  if (bodyLanguage != null && typeof bodyLanguage === 'string' && bodyLanguage.trim() !== '') {
    return normalizeBookingLanguage(bodyLanguage)
  }
  return detectLanguageFromRequest(request)
}
