import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { logTelemetry } from '@/lib/telemetry'
import { parseUserRequest } from '@/lib/assistantParser'

// Simple memory rate limit (best-effort MVP)
const bucket = new Map()
const WINDOW_MS = 5 * 60 * 1000
const LIMIT = 20

function keyFor(ip, handle) { return `${ip || 'unknown'}:${handle}` }
function allow(ip, handle) {
  const k = keyFor(ip, handle)
  const now = Date.now()
  let rec = bucket.get(k) || { hits: [], exp: now + WINDOW_MS }
  rec.hits = rec.hits.filter(ts => now - ts < WINDOW_MS)
  if (rec.hits.length >= LIMIT) return false
  rec.hits.push(now)
  bucket.set(k, rec)
  return true
}

function maskEmail(text = '') {
  const at = text.indexOf('@'); if (at <= 1) return '***'
  return `${text[0]}***@${text.split('@')[1]}`
}

export async function POST(req) {
  try {
    const enabled = Boolean(env?.FEATURES?.ASSISTANT)
    if (!enabled) return NextResponse.json({ error: 'Assistant disabled' }, { status: 404 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const tz = req.headers.get('x-client-timezone') || 'UTC'
    const overrideHandle = req.headers.get('x-assistant-handle')?.trim()

    // Accept text/plain or JSON { query | message, context?, handle? }
    const ctype = (req.headers.get('content-type') || '').toLowerCase()
    let raw = ''
    let json = null
    if (ctype.startsWith('text/plain')) {
      raw = (await req.text()) || ''
    } else {
      try { json = await req.json() } catch { json = null }
    }

    const message = (typeof raw === 'string' && raw.trim()) || json?.message || json?.query || ''
    const handle = overrideHandle || json?.handle || json?.context?.handle || ''

    if (!handle || !message) return NextResponse.json({ error: 'Missing handle or message' }, { status: 400 })

    if (!allow(ip, handle)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const intent = parseUserRequest(message)

    async function api(path, init = {}) {
      const base = env.BASE_URL
      const url = `${base}/api${path}`
      const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`)
      return data
    }

    if (intent.type === 'find_slots') {
      const dates = intent.dates || []
      const duration = intent.durationMin || 30
      let allSlots = []
      for (const d of dates) {
        try {
          const data = await api(`/public/${encodeURIComponent(handle)}/availability?date=${d}&tz=${encodeURIComponent(tz)}&duration=${duration}`)
          const slots = (data?.slots || [])
            .filter(s => withinWindow(s.start, intent.window, tz))
            .slice(0, 8)
            .map(s => decorateSlotLabels(s, tz, data?.hostTimeZone || 'UTC'))
          allSlots = allSlots.concat(slots)
        } catch {}
      }
      await safeLog('assistant_turn', { intent: 'find_slots', handle, tz, message })
      const reply = allSlots.length ? `I found ${allSlots.length} option(s). Pick a time to book.` : `I couldn’t find matching times. Try a different time or date.`
      return NextResponse.json({ intent: 'find_slots', slots: allSlots, reply })
    }

    if (intent.type === 'book') {
      const { start, end } = intent
      if (!start || !end) return NextResponse.json({ error: 'Missing start/end' }, { status: 400 })
      const slot = decorateSlotLabels({ start, end }, tz, intent.hostTz || 'UTC')
      await safeLog('assistant_turn', { intent: 'book', handle, tz, message })
      return NextResponse.json({ intent: 'book', slots: [slot], reply: 'Okay, I can book this. Please confirm your name and email.' })
    }

    await safeLog('assistant_turn', { intent: 'clarify', handle, tz, message })
    return NextResponse.json({ intent: 'clarify', reply: 'Could you clarify a date/time? For example: "30m tomorrow afternoon" or "next Wed 3pm".' })
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

function withinWindow(isoStart, window, tz) {
  if (!window) return true
  try {
    const d = new Date(isoStart)
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(d))
    if (window === 'morning') return hour >= 8 && hour < 12
    if (window === 'afternoon') return hour >= 12 && hour < 17
    if (window === 'evening') return hour >= 17 && hour < 21
    return true
  } catch { return true }
}

function decorateSlotLabels(slot, guestTz, hostTz) {
  const start = new Date(slot.start)
  const fmt = (d, tz) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d)
  return { ...slot, guestLabel: fmt(start, guestTz), hostLabel: fmt(start, hostTz) }
}

async function safeLog(event, data) {
  try {
    const masked = { ...data }
    if (masked.email) masked.email = maskEmail(masked.email)
    logTelemetry(event, masked)
  } catch {}
}
