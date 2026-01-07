/**
 * GET /api/ops/tools
 * 
 * Proxy to internal ops tools endpoint.
 * Returns list of registered tools with schemas and examples.
 */

import { NextRequest, NextResponse } from 'next/server'
import { opsGet } from '../_lib/opsFetch'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Pass through query parameters
  const params: Record<string, string | undefined> = {
    category: searchParams.get('category') || undefined,
    includeDeprecated: searchParams.get('includeDeprecated') || undefined,
    format: searchParams.get('format') || 'full'
  }
  
  const result = await opsGet('/api/internal/ops/tools', params)
  
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    )
  }
  
  return NextResponse.json(result.data)
}
