/**
 * POST /api/ops/requests/[id]/execute
 * 
 * Proxy to internal ops execute endpoint.
 * Executes an approved request.
 */

import { NextRequest, NextResponse } from 'next/server'
import { opsPost } from '../../../_lib/opsFetch'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  let body = {}
  try {
    const text = await request.text()
    if (text) {
      body = JSON.parse(text)
    }
  } catch {
    // Body is optional
  }
  
  const result = await opsPost(`/api/internal/ops/requests/${id}/execute`, body)
  
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, details: result.data?.error },
      { status: result.status }
    )
  }
  
  return NextResponse.json(result.data)
}
