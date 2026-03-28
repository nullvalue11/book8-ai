/**
 * Primary voice / greeting language for AI receptionist (ISO 639-1 codes).
 * Used by setup wizard and persisted on business documents.
 */

export const PRIMARY_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'ar', label: 'Arabic' },
  { code: 'zh', label: 'Mandarin Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'pl', label: 'Polish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'th', label: 'Thai' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'cs', label: 'Czech' },
  { code: 'ro', label: 'Romanian' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'ms', label: 'Malay' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'fi', label: 'Finnish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'hr', label: 'Croatian' }
]

const CODE_SET = new Set(PRIMARY_LANGUAGE_OPTIONS.map((o) => o.code))

/** @param {string | null | undefined} code */
export function normalizePrimaryLanguage(code) {
  const c = String(code || '')
    .trim()
    .toLowerCase()
    .slice(0, 8)
  if (CODE_SET.has(c)) return c
  return 'en'
}
