/**
 * GET /api/ops/tools
 * 
 * Proxy to internal ops tools endpoint.
 * Returns list of registered tools with schemas and examples.
 * Includes rate limit headers for UI display.
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
  
  // Build response headers (include rate limit info)
  const responseHeaders: Record<string, string> = {}
  if (result.headers?.rateLimitLimit) {
    responseHeaders['X-RateLimit-Limit'] = result.headers.rateLimitLimit
  }
  if (result.headers?.rateLimitRemaining) {
    responseHeaders['X-RateLimit-Remaining'] = result.headers.rateLimitRemaining
  }
  if (result.headers?.rateLimitReset) {
    responseHeaders['X-RateLimit-Reset'] = result.headers.rateLimitReset
  }
  
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: responseHeaders }
    )
  }
  
  return NextResponse.json(result.data, { headers: responseHeaders })
}
