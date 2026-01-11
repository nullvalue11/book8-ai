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
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
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
    
    // Priority 2: Fallback to rateLimit object in response data
    if (!responseHeaders['X-RateLimit-Limit'] && result.data?.rateLimit) {
      const rl = result.data.rateLimit
      if (rl.limit !== undefined) responseHeaders['X-RateLimit-Limit'] = String(rl.limit)
      if (rl.remaining !== undefined) responseHeaders['X-RateLimit-Remaining'] = String(rl.remaining)
      if (rl.windowMs !== undefined) {
        responseHeaders['X-RateLimit-Reset'] = String(Math.ceil((Date.now() + rl.windowMs) / 1000))
      }
    }
    
    // Log for debugging
    console.log('[ops/tools proxy] Rate limit headers:', {
      fromFetch: result.headers,
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
    console.error('[ops/tools proxy] Unhandled error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal proxy error' },
      { status: 500 }
    )
  }
}
