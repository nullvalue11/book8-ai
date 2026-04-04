import { NextResponse } from 'next/server'
import { corePlacesBaseUrl, corePlacesConfigured, corePlacesInternalHeaders } from '../_lib/core-places'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  const url = new URL(request.url)
  const reference = (url.searchParams.get('reference') || '').trim()
  const maxwidth = (url.searchParams.get('maxwidth') || '800').trim() || '800'

  if (!reference) {
    return NextResponse.json({ error: 'Missing photo reference' }, { status: 400 })
  }

  if (!corePlacesConfigured()) {
    return NextResponse.json({ error: 'Places proxy not configured' }, { status: 503 })
  }

  const coreUrl = new URL(`${corePlacesBaseUrl()}/api/places/photo`)
  coreUrl.searchParams.set('reference', reference)
  coreUrl.searchParams.set('maxwidth', maxwidth)

  try {
    const res = await fetch(coreUrl.toString(), {
      headers: corePlacesInternalHeaders(false),
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Photo unavailable' }, { status: 502 })
    }

    const imageBuffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      }
    })
  } catch (e) {
    console.warn('[places/photo]', e?.message || e)
    return NextResponse.json({ error: 'Photo fetch failed' }, { status: 502 })
  }
}
