/**
 * POST /api/wizard/infer-profile
 * LLM-inferred business profile for the public /create wizard (Phase 1).
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { env } from '@/lib/env'
import { isValidIanaTimeZone } from '@/lib/timezones'
import { verticals } from '@/for/_data/verticals'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RATE_WINDOW_MS = 60_000
const RATE_MAX = 5
const DESC_MAX = 200
const MODEL = 'claude-haiku-4-5-20251001'

const rateBucket =
  globalThis.__book8WizardInferRateLimit ??
  (globalThis.__book8WizardInferRateLimit = new Map())

const SYSTEM_PROMPT = `You are a business profile inference engine. Given a URL or short description of a business, return a plausible business profile in strict JSON format. Use sensible defaults for missing data, marking those fields with "_confidence": "low".

Output schema (JSON only, no markdown):
{
  "businessName": string,
  "description": string (1-3 sentences, plausible and category-appropriate),
  "category": "barber" | "dental" | "spa" | "fitness" | "physio" | "other",
  "country": string (e.g. "United States", "Canada"),
  "timezone": string (IANA format, e.g. "America/New_York"),
  "language": "en" | "fr" | "es" | "ar",
  "address": string | null (use null if unknown, frontend will show "(please confirm)"),
  "websiteUrl": string,
  "sampleServices": [{ "name": string, "durationMinutes": number, "priceEstimate": number }] (3-5 services typical for the category),
  "_confidence": {
    "businessName": "high" | "medium" | "low",
    "address": "high" | "low",
    "category": "high" | "medium"
  }
}

Rules:
- Always parse the input charitably. "dropbarber.com" → "Drop Barber" (split on common patterns, capitalize)
- If no category signal in URL, infer from description. If neither, default to "other" with low confidence.
- Default country to "United States" unless URL TLD or text suggests otherwise (.ca → Canada, .uk → UK, etc.)
- Sample services should be priced realistically (barber: $25-45, dental cleaning: $80-150, spa: $60-180, etc.)
- Return JSON ONLY. No markdown fences. No explanation. No preamble.`

const STRICT_RETRY_INSTRUCTION =
  'Your previous reply was not valid JSON. Reply with ONE JSON object only that matches the schema from the system message. No markdown, no code fences, no text before or after the object.'

const CATEGORIES = new Set(['barber', 'dental', 'spa', 'fitness', 'physio', 'other'])
const LANGS = new Set(['en', 'fr', 'es', 'ar'])

function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) {
    const first = xf.split(',')[0]?.trim()
    if (first) return first
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip) {
  const now = Date.now()
  let row = rateBucket.get(ip)
  if (!row || now > row.resetAt) {
    row = { count: 0, resetAt: now + RATE_WINDOW_MS }
    rateBucket.set(ip, row)
  }
  if (row.count >= RATE_MAX) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((row.resetAt - now) / 1000)) }
  }
  row.count += 1
  return { ok: true }
}

function sanitizeDescription(raw) {
  if (raw == null || typeof raw !== 'string') return ''
  const stripped = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim()
  return stripped.slice(0, DESC_MAX)
}

function verticalHintLine(verticalSlug) {
  if (!verticalSlug || typeof verticalSlug !== 'string') return ''
  const slug = verticalSlug.trim().slice(0, 64)
  const v = verticals[slug]
  const label = v?.label || slug.replace(/-/g, ' ')
  const categoryMap = {
    barbershops: 'barber',
    dental: 'dental',
    'spas-and-beauty': 'spa',
    'fitness-studios': 'fitness',
    'physio-clinics': 'physio'
  }
  const cat = categoryMap[slug] || 'other'
  return `Additional context: this user came from a "${label}" landing page, so the category is almost certainly "${cat}".`
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') throw new Error('empty model output')
  const t = text.trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no json object in output')
  return JSON.parse(t.slice(start, end + 1))
}

function normalizeWebsiteUrl(url, fallbackFromInput) {
  const u = typeof url === 'string' ? url.trim() : ''
  if (u) {
    if (/^https?:\/\//i.test(u)) return u
    return `https://${u.replace(/^\/+/, '')}`
  }
  const fb = typeof fallbackFromInput === 'string' ? fallbackFromInput.trim() : ''
  if (!fb) return ''
  if (/^https?:\/\//i.test(fb)) return fb
  if (fb.includes('.') && !fb.includes(' ')) return `https://${fb.replace(/^\/+/, '')}`
  return ''
}

function coerceServices(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const name = typeof s.name === 'string' ? s.name.trim().slice(0, 120) : ''
    if (!name) continue
    const durationMinutes =
      typeof s.durationMinutes === 'number' && Number.isFinite(s.durationMinutes)
        ? Math.max(5, Math.min(480, Math.round(s.durationMinutes)))
        : 30
    const priceEstimate =
      typeof s.priceEstimate === 'number' && Number.isFinite(s.priceEstimate)
        ? Math.max(0, Math.round(s.priceEstimate))
        : 0
    out.push({ name, durationMinutes, priceEstimate })
    if (out.length >= 5) break
  }
  return out
}

function safeProfile(partial, inputDescription) {
  const category = CATEGORIES.has(partial?.category) ? partial.category : 'other'
  const language = LANGS.has(partial?.language) ? partial.language : 'en'
  let timezone =
    typeof partial?.timezone === 'string' && isValidIanaTimeZone(partial.timezone)
      ? partial.timezone
      : 'America/New_York'
  const country =
    typeof partial?.country === 'string' && partial.country.trim()
      ? partial.country.trim().slice(0, 80)
      : 'United States'
  const businessName =
    typeof partial?.businessName === 'string' && partial.businessName.trim()
      ? partial.businessName.trim().slice(0, 120)
      : 'Your business'
  const description =
    typeof partial?.description === 'string' ? partial.description.trim().slice(0, 800) : ''
  const address =
    partial?.address === null
      ? null
      : typeof partial?.address === 'string'
        ? partial.address.trim().slice(0, 240) || null
        : null
  const websiteUrl = normalizeWebsiteUrl(partial?.websiteUrl, inputDescription)
  const sampleServices = coerceServices(partial?.sampleServices)
  const conf = partial?._confidence && typeof partial._confidence === 'object' ? partial._confidence : {}
  const _confidence = {
    businessName: ['high', 'medium', 'low'].includes(conf.businessName) ? conf.businessName : 'low',
    address: ['high', 'low'].includes(conf.address) ? conf.address : 'low',
    category: ['high', 'medium'].includes(conf.category) ? conf.category : 'medium'
  }
  return {
    businessName,
    description,
    category,
    country,
    timezone,
    language,
    address,
    websiteUrl,
    sampleServices,
    _confidence
  }
}

function defaultProfile(inputDescription) {
  return safeProfile(
    {
      businessName: 'Your business',
      description: '',
      category: 'other',
      country: 'United States',
      timezone: 'America/New_York',
      language: 'en',
      address: null,
      websiteUrl: normalizeWebsiteUrl('', inputDescription),
      sampleServices: [],
      _confidence: {
        businessName: 'low',
        address: 'low',
        category: 'low'
      }
    },
    inputDescription
  )
}

async function callAnthropic(userText, system) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: userText }]
  })
  const block = msg.content?.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

export async function POST(request) {
  const ip = clientIp(request)
  const limited = checkRateLimit(ip)
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limit', retryAfter: limited.retryAfter },
      {
        status: 429,
        headers: { 'Retry-After': String(limited.retryAfter) }
      }
    )
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const rawDesc = body.description
  const description = sanitizeDescription(typeof rawDesc === 'string' ? rawDesc : '')
  const verticalRaw = typeof body.vertical === 'string' ? body.vertical : ''
  const vertical = verticalRaw.trim().slice(0, 64)

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, profile: defaultProfile(description) })
  }

  const hint = verticalHintLine(vertical)
  const system = hint ? `${SYSTEM_PROMPT}\n\n${hint}` : SYSTEM_PROMPT
  const userLine = `Infer a business profile for this input:\n${description || '(empty — return cautious defaults with low confidence)'}`

  let profile = defaultProfile(description)
  let inferenceOk = true

  try {
    const text = await callAnthropic(userLine, system)
    if (text) {
      try {
        const parsed = extractJsonObject(text)
        profile = safeProfile(parsed, description)
      } catch (parseErr) {
        console.warn('[wizard/infer-profile] JSON parse failed, retrying:', parseErr?.message || parseErr)
        const retryText = await callAnthropic(
          `${STRICT_RETRY_INSTRUCTION}\n\nInput:\n${userLine}\n\nPrevious (invalid) output:\n${text.slice(0, 4000)}`,
          system
        )
        const parsed2 = extractJsonObject(retryText)
        profile = safeProfile(parsed2, description)
      }
    } else {
      inferenceOk = false
    }
  } catch (e) {
    inferenceOk = false
    console.error('[wizard/infer-profile] inference_failed:', e?.message || e)
    profile = defaultProfile(description)
  }

  if (!inferenceOk) {
    return NextResponse.json({
      ok: false,
      error: 'inference_failed',
      profile
    })
  }

  return NextResponse.json({ ok: true, profile })
}
