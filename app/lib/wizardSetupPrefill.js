/**
 * Read /create wizard sessionStorage and map fields for /setup prefill (BOO-WIZARD Phase 4A).
 * Schema comments live next to mapping — keep in sync with Step1Profile / Step2Agent.
 */

import { COUNTRY_OPTIONS } from '@/lib/countries'
import { guessCountryFromTimeZone } from '@/lib/region-data'

export const WIZARD_SESSION_STEP1_KEY = 'book8.wizard.step1'
export const WIZARD_SESSION_STEP2_KEY = 'book8.wizard.step2'
export const WIZARD_SESSION_PROFILE_KEY = 'book8.wizard.profileFromCreate'

const SETUP_CATEGORIES = new Set([
  'barber',
  'dental',
  'spa',
  'fitness',
  'medical',
  'restaurant',
  'other'
])

/** Wizard /create uses `physio`; /setup uses `medical`. */
export function mapWizardCategoryToSetup(category) {
  const c = String(category || '').trim().toLowerCase()
  if (c === 'physio') return 'medical'
  if (SETUP_CATEGORIES.has(c)) return c
  return 'other'
}

function mapShortLangToWizardVoiceCode(short) {
  const s = String(short || '').trim().toLowerCase()
  if (s === 'en') return 'en-US'
  if (s === 'fr') return 'fr-FR'
  if (s === 'es') return 'es-419'
  if (s === 'ar') return 'ar'
  return 'en-US'
}

export function countryLabelToProfileCode(label) {
  const t = String(label || '').trim()
  if (!t) return null
  const hit = COUNTRY_OPTIONS.find((c) => c.label.toLowerCase() === t.toLowerCase())
  return hit?.code ?? null
}

/**
 * /create HoursEditor: { monday: { isOpen, start, end }, ... }
 * /setup businessHours: { monday: [{ start, end }], ... }
 */
export function wizardHoursToBusinessHours(hours) {
  if (!hours || typeof hours !== 'object') return null
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  ]
  const out = {}
  for (const d of days) {
    const b = hours[d]
    if (!b || typeof b !== 'object') {
      out[d] = []
      continue
    }
    if (Array.isArray(b)) {
      out[d] = b
        .filter((x) => x && typeof x.start === 'string' && typeof x.end === 'string')
        .map((x) => ({ start: x.start, end: x.end }))
      continue
    }
    if (b.isOpen && typeof b.start === 'string' && typeof b.end === 'string') {
      out[d] = [{ start: b.start, end: b.end }]
    } else {
      out[d] = []
    }
  }
  return out
}

export function priceCentsToStep5PriceStr(cents) {
  const n = Number(cents)
  if (!Number.isFinite(n) || n < 0) return ''
  const dollars = n / 100
  if (Number.isInteger(dollars)) return String(dollars)
  return String(dollars)
}

function decodeBase64Utf8(b64) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8')
  }
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function decodeProfileFromCreate(raw) {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const json = decodeBase64Utf8(raw.trim())
    const data = JSON.parse(json)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}

function normalizeStep2(raw) {
  if (!raw || typeof raw !== 'object') return null
  let voiceLang =
    typeof raw.voiceLang === 'string' && raw.voiceLang.trim() ? raw.voiceLang.trim() : ''
  if (raw.v === 1 && voiceLang) {
    voiceLang = mapShortLangToWizardVoiceCode(voiceLang)
  }
  return {
    v: raw.v,
    voiceLang,
    hours: raw.hours && typeof raw.hours === 'object' ? raw.hours : null,
    services: Array.isArray(raw.services) ? raw.services : []
  }
}

function step1FromSessionRecord(rec) {
  if (!rec || typeof rec !== 'object' || rec.v !== 1) return null
  const form = rec.form && typeof rec.form === 'object' ? rec.form : {}
  const meta = rec.meta && typeof rec.meta === 'object' ? rec.meta : {}
  return {
    businessName: String(form.businessName || '').trim(),
    category: form.category || 'other',
    description: String(form.description || '').trim(),
    country: String(form.countryLabel || '').trim() || 'United States',
    timezone:
      typeof form.timezone === 'string' && form.timezone.trim()
        ? form.timezone.trim()
        : 'America/New_York',
    language: ['en', 'fr', 'es', 'ar'].includes(form.language) ? form.language : 'en',
    websiteUrl: String(form.websiteUrl || '').trim(),
    address:
      form.address === null || form.address === undefined
        ? null
        : String(form.address || '').trim() || null,
    sampleServices: Array.isArray(meta.sampleServices) ? meta.sampleServices : [],
    _confidence: meta._confidence && typeof meta._confidence === 'object' ? meta._confidence : {}
  }
}

/**
 * @returns {{ step1: object, step2: object | null } | null}
 */
export function readWizardCreateSessionPayload() {
  if (typeof window === 'undefined') return null

  let step1 = null
  let step2 = null

  try {
    const profRaw = sessionStorage.getItem(WIZARD_SESSION_PROFILE_KEY)
    const decoded = decodeProfileFromCreate(profRaw)
    if (decoded?.step1 && typeof decoded.step1 === 'object') {
      step1 = decoded.step1
    }
    if (decoded?.step2 && typeof decoded.step2 === 'object') {
      step2 = normalizeStep2(decoded.step2)
    }
  } catch {
    /* ignore */
  }

  if (!step1) {
    try {
      const s1 = sessionStorage.getItem(WIZARD_SESSION_STEP1_KEY)
      if (s1) {
        const rec = JSON.parse(s1)
        step1 = step1FromSessionRecord(rec)
      }
    } catch {
      /* ignore */
    }
  }

  if (!step2) {
    try {
      const s2 = sessionStorage.getItem(WIZARD_SESSION_STEP2_KEY)
      if (s2) {
        step2 = normalizeStep2(JSON.parse(s2))
      }
    } catch {
      /* ignore */
    }
  }

  if (!step1 || typeof step1 !== 'object') return null
  if (!String(step1.businessName || '').trim()) return null

  return { step1, step2 }
}

/**
 * @returns {ReturnType<typeof readWizardCreateSessionPayload> extends infer R ? R : never}
 */
export function readWizardPrefillPayload() {
  const payload = readWizardCreateSessionPayload()
  if (!payload) return null
  const { step1, step2 } = payload
  if (!String(step1.businessName || '').trim()) return null
  return payload
}

/**
 * Build /setup `wizardData` patch + services for step 5.
 * @param {{ step1: object, step2: object | null }} payload
 */
export function wizardPayloadToSetupStatePatch(payload) {
  const { step1, step2 } = payload
  const category = mapWizardCategoryToSetup(step1.category)
  const countryCode =
    countryLabelToProfileCode(step1.country) ||
    guessCountryFromTimeZone(
      typeof step1.timezone === 'string' && step1.timezone.trim() ? step1.timezone : 'UTC'
    )

  const addr =
    step1.address == null || step1.address === ''
      ? ''
      : String(step1.address).replace(/\s*\(please confirm\)\s*/gi, '').trim()

  const businessHours = step2?.hours ? wizardHoursToBusinessHours(step2.hours) : null

  const voiceLang =
    step2?.voiceLang && String(step2.voiceLang).trim()
      ? String(step2.voiceLang).trim()
      : mapShortLangToWizardVoiceCode(step1.language)

  const step5Services =
    step2?.services?.filter((s) => s && String(s.name || '').trim()) || []

  const customCategory =
    category === 'other'
      ? String(step1.description || '').trim().slice(0, 120) || 'General business'
      : ''

  const wizardPatch = {
    businessName: String(step1.businessName || '').trim(),
    category,
    customCategory,
    timezone:
      typeof step1.timezone === 'string' && step1.timezone.trim()
        ? step1.timezone.trim()
        : 'America/New_York',
    primaryLanguage: step1.language || 'en',
    profileStreet: addr,
    profileWebsite: String(step1.websiteUrl || '').trim(),
    profileDescription: String(step1.description || '').trim().slice(0, 500),
    profileCountry: countryCode,
    wizardVoiceLang: voiceLang
  }

  if (businessHours) {
    wizardPatch.businessHours = businessHours
  }

  return {
    wizardPatch,
    step5Services: step5Services.map((s) => ({
      name: String(s.name || '').trim(),
      durationMinutes: Number(s.durationMinutes) || 30,
      priceCents: Math.max(0, Math.round(Number(s.priceCents) || 0))
    }))
  }
}

export function clearBook8WizardSessionStorage() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(WIZARD_SESSION_STEP1_KEY)
    sessionStorage.removeItem(WIZARD_SESSION_STEP2_KEY)
    sessionStorage.removeItem(WIZARD_SESSION_PROFILE_KEY)
  } catch {
    /* ignore */
  }
}
