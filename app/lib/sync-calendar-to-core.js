import { env } from '@/lib/env'

/**
 * Syncs calendar connection status to core-api's business record.
 * Called after Google or Outlook calendar connect/disconnect.
 */
export async function syncCalendarToCore({ businessId, provider, connected }) {
  const CORE_API_URL =
    env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com'
  const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET

  if (!secret) {
    console.warn('[sync-calendar-to-core] No internal secret configured — skipping sync')
    return
  }

  if (!businessId) {
    console.warn('[sync-calendar-to-core] No businessId — skipping sync')
    return
  }

  try {
    const baseUrl = CORE_API_URL.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/internal/business/update-calendar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret
      },
      body: JSON.stringify({
        businessId,
        calendarProvider: connected ? provider : null,
        calendarConnected: connected
      })
    })

    if (!response.ok) {
      console.warn('[sync-calendar-to-core] Core-api returned:', response.status)
    } else {
      console.log('[sync-calendar-to-core] Synced to core-api:', {
        businessId,
        provider,
        connected
      })
    }
  } catch (err) {
    // Fire-and-forget — never crash the connect flow
    console.warn('[sync-calendar-to-core] Failed to sync:', err.message)
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
