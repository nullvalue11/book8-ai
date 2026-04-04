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

  if (!corePlacesConfigured()) {
    return NextResponse.json({ ok: true, predictions: [], unavailable: true })
  }

  const url = new URL(request.url)
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
