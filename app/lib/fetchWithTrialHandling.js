/**
 * BOO-98B: Optional fetch wrapper — do not retry 402; optional redirect on trial expiry.
 * Pass businessId when calling from a page that knows context.
 */
export async function fetchWithTrialHandling(url, options = {}, context = {}) {
  const res = await fetch(url, options)
  if (res.status !== 402) return res

  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }

  const err = data.error || data.code || ''
  const s = String(err).toLowerCase()
  if (typeof window !== 'undefined' && (s.includes('trial_expired') || s === 'trial_expired')) {
    const bid = context.businessId || new URLSearchParams(window.location.search).get('businessId')
    const q = bid ? `?businessId=${encodeURIComponent(bid)}` : ''
    window.location.href = `/upgrade${q}`
  }

  return res
}
