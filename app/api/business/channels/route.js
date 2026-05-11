/**
 * GET /api/business/channels?country=XX
 * Regional channel flags for wizard + pricing. Merges defaults; extend when core-api 1A ships.
 */

import { NextResponse } from 'next/server'
import { defaultChannelsForCountry } from '@/lib/businessChannels'
import { normalizeCountryCode } from '@/lib/plansPricingPublic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const country = normalizeCountryCode(searchParams.get('country') || 'CA')
    const channels = defaultChannelsForCountry(country)
    return NextResponse.json({
      ok: true,
      country,
      channels,
      source: 'default'
    })
  } catch (e) {
    console.error('[api/business/channels]', e)
    return NextResponse.json(
      { ok: false, error: e.message || 'Server error' },
      { status: 500 }
    )
  }
}
