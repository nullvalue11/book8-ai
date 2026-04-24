import { env } from '@/lib/env'
import { buildSyncCalendarStatePayload } from './syncCalendarStatePayload.js'

/**
 * Syncs calendar connection status to core-api's business record (BOO-117B).
 * Called after Google or Microsoft calendar connect/disconnect.
 * Never throws — failures are logged and returned as `{ ok: false, ... }`.
 */
export async function syncCalendarToCore({
  businessId,
  connected,
  provider,
  connectedAt,
  calendarId,
  lastSyncedAt
}) {
  if (!businessId) {
    console.warn('[syncCalendarToCore] Missing businessId, skipping')
    return { ok: false, reason: 'missing_businessId' }
  }

  const coreApiUrlRaw =
    env.CORE_API_URL || env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const coreApiUrl = String(coreApiUrlRaw).replace(/\/$/, '')
  const secret =
    env.CORE_API_INTERNAL_SECRET || env.INTERNAL_API_SECRET || env.OPS_INTERNAL_SECRET

  if (!secret) {
    console.warn('[syncCalendarToCore] Missing CORE_API_INTERNAL_SECRET (or INTERNAL_API_SECRET), skipping')
    return { ok: false, reason: 'missing_secret' }
  }

  try {
    const response = await fetch(`${coreApiUrl}/internal/business/sync-calendar-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret
      },
      body: JSON.stringify(
        buildSyncCalendarStatePayload({
          businessId,
          connected,
          provider,
          connectedAt,
          calendarId,
          lastSyncedAt
        })
      )
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.warn('[syncCalendarToCore] Non-OK response:', {
        status: response.status,
        body: body.slice(0, 300)
      })
      return { ok: false, status: response.status }
    }

    const data = await response.json().catch(() => ({}))
    console.log('[syncCalendarToCore] Synced:', { businessId, skipped: data.skipped || false })
    return { ok: true, ...data }
  } catch (err) {
    console.error('[syncCalendarToCore] Error:', err?.message || err)
    return { ok: false, error: err?.message }
  }
}

/**
 * Push business timezone (and optional voice/language fields) to core-api.
 * Uses /internal/business/update-calendar — core merges fields on the business record.
 */
export async function syncTimezoneToCore({
  businessId,
  timezone,
  primaryLanguage,
  multilingualEnabled
}) {
  const CORE_API_URL =
    env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET

  if (!secret) {
    console.warn('[sync-timezone-to-core] No internal secret configured — skipping sync')
    return { ok: false, skipped: true }
  }

  if (!businessId || !timezone) {
    console.warn('[sync-timezone-to-core] Missing businessId or timezone — skipping')
    return { ok: false, skipped: true }
  }

  try {
    const baseUrl = CORE_API_URL.replace(/\/$/, '')
    const payload = {
      businessId,
      timezone,
      ...(primaryLanguage != null && primaryLanguage !== ''
        ? { primaryLanguage }
        : {}),
      ...(multilingualEnabled != null
        ? { multilingualEnabled: !!multilingualEnabled }
        : {})
    }
    const response = await fetch(`${baseUrl}/internal/business/update-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret,
        'x-internal-secret': secret
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[sync-timezone-to-core] Core-api returned:', response.status, text.slice(0, 200))
      return { ok: false, status: response.status }
    }
    console.log('[sync-timezone-to-core] Synced timezone:', { businessId, timezone })
    return { ok: true }
  } catch (err) {
    console.warn('[sync-timezone-to-core] Failed:', err.message)
    return { ok: false, error: err.message }
  }
}

/**
 * Push subscription plan tier to core-api (merges on business record).
 */
export async function syncPlanToCore({ businessId, plan }) {
  const CORE_API_URL =
    env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET

  if (!secret) {
    console.warn('[sync-plan-to-core] No internal secret — skipping')
    return { ok: false, skipped: true }
  }
  if (!businessId || plan == null) {
    console.warn('[sync-plan-to-core] Missing businessId or plan — skipping')
    return { ok: false, skipped: true }
  }

  try {
    const baseUrl = CORE_API_URL.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/internal/business/update-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret,
        'x-internal-secret': secret
      },
      body: JSON.stringify({ businessId, plan })
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.warn('[sync-plan-to-core] Core-api returned:', response.status, text.slice(0, 200))
      return { ok: false, status: response.status }
    }
    console.log('[sync-plan-to-core] Synced plan:', { businessId, plan })
    return { ok: true }
  } catch (err) {
    console.warn('[sync-plan-to-core] Failed:', err.message)
    return { ok: false, error: err.message }
  }
}
