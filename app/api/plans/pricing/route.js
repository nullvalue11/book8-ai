/**
 * GET /api/plans/pricing?country=XX
 * Proxies book8-core-api for public marketing + wizard (BOO-MULTI-CURRENCY-1B).
 */

import { NextResponse } from 'next/server'
import { fetchPlansPricingFromCore } from '@/lib/plansPricingServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') || 'US'
    const normalized = await fetchPlansPricingFromCore(country)
    if (!normalized) {
      return NextResponse.json({ ok: false, error: 'Pricing unavailable' })
    }
    return NextResponse.json({
      ok: true,
      country: normalized.country,
      starter: normalized.starter,
      growth: normalized.growth,
      enterprise: normalized.enterprise
    })
  } catch (e) {
    console.error('[api/plans/pricing]', e)
    return NextResponse.json(
      { ok: false, error: e.message || 'Server error' },
      { status: 500 }
    )
  }
}
