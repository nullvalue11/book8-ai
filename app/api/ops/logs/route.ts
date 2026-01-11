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
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
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
    // Check both headers from fetch and rateLimit object in data
    const responseHeaders: Record<string, string> = {}
    
    // Priority 1: Use headers from the fetch response
    if (result.headers?.rateLimitLimit) {
      responseHeaders['X-RateLimit-Limit'] = result.headers.rateLimitLimit
    }
    if (result.headers?.rateLimitRemaining) {
      responseHeaders['X-RateLimit-Remaining'] = result.headers.rateLimitRemaining
    }
    if (result.headers?.rateLimitReset) {
      responseHeaders['X-RateLimit-Reset'] = result.headers.rateLimitReset
    }
    
    // Priority 2: Fallback to rateLimit object in response data (if headers not present)
    if (!responseHeaders['X-RateLimit-Limit'] && result.data?.rateLimit) {
      const rl = result.data.rateLimit
      if (rl.limit !== undefined) responseHeaders['X-RateLimit-Limit'] = String(rl.limit)
      if (rl.remaining !== undefined) responseHeaders['X-RateLimit-Remaining'] = String(rl.remaining)
      if (rl.windowMs !== undefined) {
        // Calculate reset time from windowMs
        responseHeaders['X-RateLimit-Reset'] = String(Math.ceil((Date.now() + rl.windowMs) / 1000))
      }
    }
    
    // Log for debugging in production
    console.log('[ops/logs proxy] Rate limit headers:', {
      fromFetch: {
        limit: result.headers?.rateLimitLimit,
        remaining: result.headers?.rateLimitRemaining,
        reset: result.headers?.rateLimitReset
      },
      fromData: result.data?.rateLimit,
      toClient: responseHeaders
    })
    
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, headers: responseHeaders }
      )
    }
    
    return NextResponse.json(result.data, { headers: responseHeaders })
    
  } catch (error: any) {
    console.error('[ops/logs proxy] Unhandled error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal proxy error' },
      { status: 500 }
    )
  }
}
