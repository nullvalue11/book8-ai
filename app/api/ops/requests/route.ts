/**
 * GET/POST /api/ops/requests
 * 
 * Proxy to internal ops requests endpoint.
 * GET: List approval requests
 * POST: Create new approval request
 */

import { NextRequest, NextResponse } from 'next/server'
import { opsGet, opsPost } from '../_lib/opsFetch'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Pass through query parameters
  const params: Record<string, string | undefined> = {
    status: searchParams.get('status') || undefined,
    tool: searchParams.get('tool') || undefined,
    limit: searchParams.get('limit') || undefined,
    skip: searchParams.get('skip') || undefined
  }
  
  const result = await opsGet('/api/internal/ops/requests', params)
  
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    )
  }
  
  return NextResponse.json(result.data)
}

export async function POST(request: NextRequest) {
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
  
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, details: result.data?.error },
      { status: result.status }
    )
  }
  
  return NextResponse.json(result.data, { status: 201 })
}
