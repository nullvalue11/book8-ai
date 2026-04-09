/**
 * BOO-84B: Push full service list to book8-core-api after dashboard mutations.
 * Uses POST /api/businesses/:businessId/services/sync (BOO-84A).
 */

import {
  getCoreApiBaseUrl,
  getCoreApiInternalHeadersJson,
  hasCoreApiInternalCredentials
} from '@/lib/core-api-internal'

function normalizeServicesList(raw) {
  if (Array.isArray(raw?.services)) return raw.services
  if (Array.isArray(raw)) return raw
  return []
}

function derivePriceCents(s) {
  if (s?.priceCents != null) {
    const n = Math.round(Number(s.priceCents))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  }
  if (s?.priceAmount != null) {
    const n = Number(s.priceAmount)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n * 100))
  }
  if (s?.price != null) {
    if (typeof s.price === 'number' && Number.isFinite(s.price)) {
      return Math.max(0, Math.round(s.price * 100))
    }
    const str = String(s.price).trim().replace(/^\$/, '')
    const n = parseFloat(str)
    if (Number.isFinite(n)) return Math.max(0, Math.round(n * 100))
  }
  return 0
}

function mapCoreServiceToSyncRow(s) {
  const serviceId = String(s?.serviceId ?? s?.id ?? '').trim()
  if (!serviceId) return null
  const currency = (s?.currency || 'CAD').toString().toUpperCase().slice(0, 3) || 'CAD'
  return {
    serviceId,
    name: typeof s?.name === 'string' ? s.name : String(s?.name ?? ''),
    description: typeof s?.description === 'string' ? s.description : '',
    durationMinutes: Number(s?.durationMinutes) || 30,
    priceCents: derivePriceCents(s),
    currency,
    active: s?.active !== false
  }
}

/**
 * @param {string} businessId
 * @returns {Promise<{ ok: boolean, error?: string, [k: string]: unknown }>}
 */
export async function syncServicesToCore(businessId) {
  if (!businessId || typeof businessId !== 'string') {
    return { ok: false, error: 'businessId required' }
  }
  if (!hasCoreApiInternalCredentials()) {
    console.warn('[services-sync] skipped — core API credentials not configured', { businessId })
    return { ok: false, error: 'no_credentials' }
  }

  const baseUrl = getCoreApiBaseUrl()
  const headers = getCoreApiInternalHeadersJson()

  try {
    const listRes = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services`,
      {
        method: 'GET',
        headers,
        cache: 'no-store'
      }
    )

    if (!listRes.ok) {
      const errText = await listRes.text().catch(() => '')
      console.error('[services-sync-failed] list', { businessId, status: listRes.status, error: errText })
      return { ok: false, error: errText || `list ${listRes.status}` }
    }

    const listData = await listRes.json().catch(() => ({}))
    const rows = normalizeServicesList(listData)
      .map(mapCoreServiceToSyncRow)
      .filter(Boolean)

    const payload = { services: rows }

    const syncRes = await fetch(
      `${baseUrl}/api/businesses/${encodeURIComponent(businessId)}/services/sync`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store'
      }
    )

    if (!syncRes.ok) {
      const errText = await syncRes.text().catch(() => '')
      console.error('[services-sync-failed] sync', { businessId, status: syncRes.status, error: errText })
      return { ok: false, error: errText || `sync ${syncRes.status}` }
    }

    let result = {}
    try {
      result = await syncRes.json()
    } catch {
      result = {}
    }
    console.log('[services-sync-success]', { businessId, count: rows.length, ...result })
    return { ok: true, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[services-sync-error]', { businessId, error: message })
    return { ok: false, error: message }
  }
}

export function scheduleSyncServicesToCore(businessId) {
  syncServicesToCore(businessId)
    .then((r) => {
      if (!r.ok) {
        console.error('[services-sync-background-failure]', { businessId, error: r.error })
      }
    })
    .catch((e) =>
      console.error('[services-sync-background-error]', { businessId, message: e?.message || String(e) })
    )
}
