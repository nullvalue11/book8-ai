/**
 * GET/POST /api/ops/requests
 * 
 * Proxy to internal ops requests endpoint.
 * GET: List approval requests
 * POST: Create new approval request
 * Includes rate limit headers for UI display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { opsGet, opsPost, OpsFetchResult } from '../_lib/opsFetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Build response headers including rate limit info
 */
function buildHeaders(result: OpsFetchResult): Record<string, string> {
  const headers: Record<string, string> = {}
  if (result.headers?.rateLimitLimit) {
    headers['X-RateLimit-Limit'] = result.headers.rateLimitLimit
  }
  if (result.headers?.rateLimitRemaining) {
    headers['X-RateLimit-Remaining'] = result.headers.rateLimitRemaining
  }
  if (result.headers?.rateLimitReset) {
    headers['X-RateLimit-Reset'] = result.headers.rateLimitReset
  }
  return headers
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Pass through query parameters
    const params: Record<string, string | undefined> = {
      status: searchParams.get('status') || undefined,
      tool: searchParams.get('tool') || undefined,
      limit: searchParams.get('limit') || undefined,
      skip: searchParams.get('skip') || undefined
    }
    
    const result = await opsGet('/api/internal/ops/requests', params)
    const headers = buildHeaders(result)
    
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status, headers }
      )
    }
    
    return NextResponse.json(result.data, { headers })
    
  } catch (error: any) {
    console.error('[ops/requests proxy GET] Unhandled error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal proxy error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    
    const result = await opsPost('/api/internal/ops/requests', body)
    const headers = buildHeaders(result)
    
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, details: result.data?.error },
        { status: result.status, headers }
      )
    }
    
    return NextResponse.json(result.data, { status: 201, headers })
    
  } catch (error: any) {
    console.error('[ops/requests proxy POST] Unhandled error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal proxy error' },
      { status: 500 }
    )
  }
}
