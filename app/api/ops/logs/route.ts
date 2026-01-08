/**
 * GET /api/ops/logs
 * 
 * Proxy to internal ops logs endpoint.
 * Returns execution logs with filtering and pagination.
 * Includes rate limit headers for UI display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { opsGet } from '../_lib/opsFetch'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Pass through all query parameters
  const params: Record<string, string | undefined> = {
    requestId: searchParams.get('requestId') || undefined,
    businessId: searchParams.get('businessId') || undefined,
    tool: searchParams.get('tool') || undefined,
    actor: searchParams.get('actor') || undefined,
    status: searchParams.get('status') || undefined,
    since: searchParams.get('since') || undefined,
    until: searchParams.get('until') || undefined,
    limit: searchParams.get('limit') || undefined,
    skip: searchParams.get('skip') || undefined
  }
  
  const result = await opsGet('/api/internal/ops/logs', params)
  
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
