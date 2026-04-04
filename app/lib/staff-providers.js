/**
 * Staff / multi-provider booking (Mongo business.providers).
 */

import { v4 as uuidv4 } from 'uuid'
import { normalizePlanKey } from '@/lib/plan-features'

function trimOrEmpty(s) {
  if (s == null || typeof s !== 'string') return ''
  return s.trim()
}

/** @returns {'starter'|'growth'|'enterprise'} */
function normPlan(p) {
  const k = String(p || 'starter').toLowerCase()
  if (k === 'growth' || k === 'enterprise') return k
  return 'starter'
}

/** Starter: none. Growth: 5. Enterprise: unlimited (-1). */
export function getMaxProvidersForPlan(plan) {
  const k = normPlan(plan)
  if (k === 'starter') return 0
  if (k === 'growth') return 5
  return -1
}

export function canAddProvider(plan, currentCount) {
  const max = getMaxProvidersForPlan(plan)
  if (max === -1) return true
  return currentCount < max
}

/** Public-safe provider list for booking page (QA-012: Starter hides team providers). */
export function sanitizeProvidersForPublic(providers, plan) {
  if (!Array.isArray(providers)) return []
  if (normalizePlanKey(plan) === 'starter') return []
  return providers
    .filter((p) => p && p.active !== false && p.id)
    .map((p) => ({
      id: String(p.id),
      name: trimOrEmpty(p.name) || 'Provider',
      title: trimOrEmpty(p.title) || null,
      serviceIds: Array.isArray(p.serviceIds) ? p.serviceIds.map((x) => String(x)) : [],
      sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0,
      avatar: p.avatar?.url && /^https?:\/\//i.test(String(p.avatar.url)) ? { url: String(p.avatar.url).slice(0, 2048) } : null
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

/**
 * Normalize day-keyed weekly hours (monday..sunday) to core abbrev sun..sat not required here;
 * keep object as-is if segments are {start,end} arrays per day.
 * @param {Record<string, unknown>} raw
 */
export function normalizeProviderWeeklyHours(raw) {
  if (!raw || typeof raw !== 'object') return null
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const out = {}
  for (const d of days) {
    const seg = raw[d]
    if (!Array.isArray(seg) || seg.length === 0) continue
    out[d] = seg
      .filter((x) => x && typeof x.start === 'string' && typeof x.end === 'string')
      .map((x) => ({
        start: String(x.start).slice(0, 8),
        end: String(x.end).slice(0, 8)
      }))
      .slice(0, 3)
  }
  return Object.keys(out).length ? out : null
}

export function createProviderId() {
  return `prv_${uuidv4().replace(/-/g, '').slice(0, 20)}`
}

export function normalizeProviderInput(body, existing = null) {
  const name = trimOrEmpty(body.name).slice(0, 120)
  if (!name) return { ok: false, error: 'Name is required' }
  const title = trimOrEmpty(body.title).slice(0, 120)
  const email = trimOrEmpty(body.email).slice(0, 200)
  const phone = trimOrEmpty(body.phone).slice(0, 40)
  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map((x) => String(x).slice(0, 80)) : []
  const weeklyHours = normalizeProviderWeeklyHours(body.weeklyHours)
  const active = body.active !== false
  const sortOrder = typeof body.sortOrder === 'number' && !Number.isNaN(body.sortOrder) ? body.sortOrder : 0
  let avatar = null
  if (body.avatar && typeof body.avatar === 'object' && body.avatar.url) {
    const u = trimOrEmpty(body.avatar.url)
    if (/^https?:\/\//i.test(u)) avatar = { url: u.slice(0, 2048) }
  } else if (existing?.avatar?.url) {
    avatar = existing.avatar
  }
  return {
    ok: true,
    provider: {
      id: existing?.id || createProviderId(),
      name,
      title: title || null,
      email: email || null,
      phone: phone || null,
      serviceIds,
      weeklyHours,
      sortOrder,
      active,
      avatar
    }
  }
}
