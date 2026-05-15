import { NextResponse } from 'next/server'
import { geolocation } from '@vercel/functions'
import { verifyPlacesBearer } from '../_lib/places-auth'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '../_lib/core-places'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'

const FIELD_MASK =
  'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'

/** @param {unknown} t */
function formattableTextToString(t) {
  if (t == null) return ''
  if (typeof t === 'string') return t.trim()
  if (typeof t === 'object' && typeof /** @type {{ text?: string }} */ (t).text === 'string') {
    return /** @type {{ text?: string }} */ (t).text.trim()
  }
  return ''
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function decodeGeoCity(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return null
  try {
    const decoded = decodeURIComponent(t.replace(/\+/g, ' ')).trim()
    return decoded || null
  } catch {
    return t || null
  }
}

/**
 * Homepage / public proxy: Google Places Autocomplete (New).
 * Soft location bias: circle when IP lat/lon exist, else optional `regionCode` (2-letter).
 * @param {{ q: string, sessionToken: string, apiKey: string, latitude: number, longitude: number, regionCode: string | null }} opts
 */
async function fetchGoogleAutocompleteNew({ q, sessionToken, apiKey, latitude, longitude, regionCode }) {
  /** @type {Record<string, unknown>} */
  const body = {
    input: q,
    sessionToken
  }
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    body.locationBias = {
      circle: {
        center: { latitude, longitude },
        radius: 50000.0
      }
    }
  } else if (regionCode && /^[a-z]{2}$/i.test(regionCode)) {
    body.regionCode = regionCode.toLowerCase()
  }

  const res = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.warn('[places/autocomplete] google new', res.status, errText.slice(0, 400))
    return null
  }

  const data = await res.json().catch(() => null)
  if (!data || typeof data !== 'object') return null

  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : []
  /** @type {Array<{ placeId: string, name: string, address: string, types: string[] }>} */
  const predictions = []

  for (const s of suggestions) {
    if (predictions.length >= 5) break
    if (!s || typeof s !== 'object') continue
    const placePrediction = /** @type {Record<string, unknown>} */ (s).placePrediction
    if (!placePrediction || typeof placePrediction !== 'object') continue
    const pp = /** @type {Record<string, unknown>} */ (placePrediction)
    const placeId = typeof pp.placeId === 'string' ? pp.placeId.trim() : ''
    if (!placeId) continue

    const structured = pp.structuredFormat && typeof pp.structuredFormat === 'object' ? pp.structuredFormat : null
    const st = structured && typeof structured === 'object' ? /** @type {Record<string, unknown>} */ (structured) : null
    let name = ''
    let address = ''
    if (st) {
      name = formattableTextToString(st.mainText)
      address = formattableTextToString(st.secondaryText)
    }
    if (!name) name = formattableTextToString(pp.text)
    if (!address && name) {
      const full = formattableTextToString(pp.text)
      if (full && full !== name) address = full.replace(name, '').replace(/^\s*[·,|-]\s*/, '').trim()
    }

    const typesRaw = pp.types
    const types = Array.isArray(typesRaw) ? typesRaw.filter((x) => typeof x === 'string') : []

    predictions.push({
      placeId,
      name: name || 'Unknown place',
      address: address || '',
      types
    })
  }

  return predictions
}

export async function GET(request) {
  const url = new URL(request.url)
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  // --- Authenticated: legacy proxy to core-api (wizard / dashboard) ---
  if (bearer) {
    const auth = await verifyPlacesBearer(request)
    if (auth.error) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    if (!corePlacesConfigured()) {
      return NextResponse.json({ ok: true, predictions: [], unavailable: true })
    }

    const query = (url.searchParams.get('query') || '').trim()
    if (query.length < 2) {
      return NextResponse.json({ ok: true, predictions: [] })
    }

    const coreUrl = new URL(`${corePlacesBaseUrl()}/api/places/autocomplete`)
    coreUrl.searchParams.set('query', query)
    coreUrl.searchParams.set('type', 'establishment')

    try {
      const res = await fetch(coreUrl.toString(), {
        headers: corePlacesInternalHeaders(false),
        cache: 'no-store'
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.warn('[places/autocomplete] core', res.status, errText.slice(0, 300))
        return NextResponse.json({ ok: true, predictions: [] })
      }

      const data = await res.json().catch(() => ({}))
      let predictions = []
      if (Array.isArray(data.predictions)) predictions = data.predictions
      else if (Array.isArray(data.results)) predictions = data.results

      return NextResponse.json({ ok: true, predictions })
    } catch (e) {
      console.warn('[places/autocomplete] fetch failed', e?.message || e)
      return NextResponse.json({ ok: true, predictions: [] })
    }
  }

  // --- Public: homepage hero (Google Places API New, server key) ---
  // TODO: rate limit by IP — defer to BOO-AUTOCOMPLETE-RATELIMIT-1A
  // Note: geolocation() returns empty values in local dev. Deploy to Vercel Preview to test geo-biased results.
  const geo = geolocation(request)
  const latitude = parseFloat(String(geo.latitude ?? ''))
  const longitude = parseFloat(String(geo.longitude ?? ''))
  const nearCity = decodeGeoCity(geo.city)

  const q = (url.searchParams.get('q') || '').trim()
  const sessionToken = (url.searchParams.get('sessionToken') || '').trim()
  const countryParam = (url.searchParams.get('country') || '').trim()

  /** @type {string | null} */
  let regionCodeForBody = null
  if (!(Number.isFinite(latitude) && Number.isFinite(longitude))) {
    if (countryParam && /^[A-Z]{2}$/i.test(countryParam)) {
      regionCodeForBody = countryParam.toLowerCase()
    } else {
      const gc = geo.country && String(geo.country).trim()
      if (gc && /^[A-Z]{2}$/i.test(gc)) regionCodeForBody = gc.toLowerCase()
    }
  }

  if (q.length < 2) {
    return NextResponse.json(
      { predictions: [], sessionToken: sessionToken || null, nearCity },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  }

  if (!sessionToken || sessionToken.length < 8) {
    return NextResponse.json(
      { predictions: [], sessionToken: sessionToken || null, nearCity, error: 'autocomplete_failed' },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  }

  // Public branch: read server key first (API-restricted, no browser referrer). Do not use env.js merge here.
  const apiKey = String(process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('[places/autocomplete] public: GOOGLE_MAPS_SERVER_KEY / GOOGLE_MAPS_API_KEY unset')
    return NextResponse.json(
      { predictions: [], sessionToken, nearCity, error: 'autocomplete_failed' },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  }

  try {
    const predictions = await fetchGoogleAutocompleteNew({
      q,
      sessionToken,
      apiKey,
      latitude,
      longitude,
      regionCode: regionCodeForBody
    })
    if (!predictions) {
      return NextResponse.json(
        { predictions: [], sessionToken, nearCity, error: 'autocomplete_failed' },
        { headers: { 'Cache-Control': 'private, max-age=60' } }
      )
    }
    return NextResponse.json(
      { predictions, sessionToken, nearCity },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (e) {
    console.warn('[places/autocomplete] google new fetch failed', e?.message || e)
    return NextResponse.json(
      { predictions: [], sessionToken, nearCity, error: 'autocomplete_failed' },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  }
}
