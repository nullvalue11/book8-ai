import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { verifyPlacesBearer } from '../_lib/places-auth'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '../_lib/core-places'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GOOGLE_PLACE_GET_BASE = 'https://places.googleapis.com/v1/places/'

/**
 * Public, minimal Place preview for sign-in context (name + address only). BOO-AUTH-CTX-PRESERVATION-1B
 * @param {URL} url
 */
async function publicPlacePreviewGet(url) {
  const placeId = (url.searchParams.get('placeId') || '').trim()
  const sessionToken = (url.searchParams.get('sessionToken') || '').trim()
  if (!placeId) {
    return NextResponse.json({ ok: false, error: 'placeId required' }, { status: 400 })
  }
  const apiKey = env.GOOGLE_MAPS_API_KEY ? String(env.GOOGLE_MAPS_API_KEY).trim() : ''
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Places preview unavailable' }, { status: 503 })
  }
  const rawId = placeId.replace(/^places\//, '')
  if (!rawId) {
    return NextResponse.json({ ok: false, error: 'placeId required' }, { status: 400 })
  }
  const placeResource = encodeURIComponent(rawId)
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'displayName,formattedAddress'
  }
  if (sessionToken && sessionToken.length >= 8) {
    headers['X-Goog-Session-Token'] = sessionToken
  }
  try {
    const res = await fetch(`${GOOGLE_PLACE_GET_BASE}${placeResource}`, {
      method: 'GET',
      headers,
      cache: 'no-store'
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error?.message || 'Place preview failed' },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      )
    }
    const dn = data && typeof data === 'object' ? /** @type {Record<string, unknown>} */ (data).displayName : null
    const name =
      dn && typeof dn === 'object' && typeof /** @type {{ text?: string }} */ (dn).text === 'string'
        ? /** @type {{ text?: string }} */ (dn).text.trim()
        : typeof dn === 'string'
          ? dn.trim()
          : ''
    const formattedAddress =
      data && typeof data === 'object' && typeof /** @type {Record<string, unknown>} */ (data).formattedAddress === 'string'
        ? String(/** @type {Record<string, unknown>} */ (data).formattedAddress).trim()
        : ''
    return NextResponse.json(
      { ok: true, name: name || 'Selected place', formattedAddress },
      { headers: { 'Cache-Control': 'private, max-age=120' } }
    )
  } catch (e) {
    console.warn('[places/details] public preview', e?.message || e)
    return NextResponse.json({ ok: false, error: 'Place preview error' }, { status: 502 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  if (!bearer) {
    return publicPlacePreviewGet(url)
  }

  const auth = await verifyPlacesBearer(request)
  if (auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const placeId = (url.searchParams.get('placeId') || '').trim()
  const sessionToken = (url.searchParams.get('sessionToken') || '').trim()
  if (!placeId) {
    return NextResponse.json({ ok: false, error: 'placeId required' }, { status: 400 })
  }

  if (!corePlacesConfigured()) {
    return NextResponse.json({ ok: false, error: 'Places service unavailable', unavailable: true }, { status: 503 })
  }

  const coreUrl = new URL(`${corePlacesBaseUrl()}/api/places/details`)
  coreUrl.searchParams.set('placeId', placeId)
  if (sessionToken) coreUrl.searchParams.set('sessionToken', sessionToken)

  try {
    const res = await fetch(coreUrl.toString(), {
      headers: corePlacesInternalHeaders(false),
      cache: 'no-store'
    })

    const data = await res.json().catch(() => (null))

    if (!res.ok) {
      console.warn('[places/details] core', res.status)
      return NextResponse.json(
        { ok: false, error: data?.error || 'Details request failed' },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      )
    }

    return NextResponse.json(data && typeof data === 'object' && !Array.isArray(data) ? data : { result: data })
  } catch (e) {
    console.warn('[places/details] fetch failed', e?.message || e)
    return NextResponse.json({ ok: false, error: 'Places service error' }, { status: 502 })
  }
}
