import { NextResponse } from 'next/server'
import { verifyPlacesBearer } from '../_lib/places-auth'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '../_lib/core-places'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const auth = await verifyPlacesBearer(request)
  if (auth.error) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const placeId = (url.searchParams.get('placeId') || '').trim()
  if (!placeId) {
    return NextResponse.json({ ok: false, error: 'placeId required' }, { status: 400 })
  }

  if (!corePlacesConfigured()) {
    return NextResponse.json({ ok: false, error: 'Places service unavailable', unavailable: true }, { status: 503 })
  }

  const coreUrl = new URL(`${corePlacesBaseUrl()}/api/places/details`)
  coreUrl.searchParams.set('placeId', placeId)

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
