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
