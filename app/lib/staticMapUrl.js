/**
 * BOO-106B: Google Static Maps URL for public booking page (browser key, domain-restricted).
 * @param {{ lat: number, lng: number, apiKey: string, width?: number, height?: number, zoom?: number }} opts
 * @returns {string | null}
 */
export function buildGoogleStaticMapUrl(opts) {
  const { lat, lng, apiKey, width = 400, height = 200, zoom = 15 } = opts
  if (apiKey == null || String(apiKey).trim() === '') return null
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null
  }
  const base = 'https://maps.googleapis.com/maps/api/staticmap'
  const u = new URL(base)
  u.searchParams.set('center', `${lat},${lng}`)
  u.searchParams.set('zoom', String(zoom))
  u.searchParams.set('size', `${width}x${height}`)
  u.searchParams.set('scale', '2')
  u.searchParams.set('markers', `color:0x8B5CF6|${lat},${lng}`)
  u.searchParams.set('key', String(apiKey).trim())
  return u.toString()
}

/**
 * @param {{ lat: number, lng: number }} loc
 */
export function buildGoogleMapsSearchUrl(loc) {
  if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null
  return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`
}
