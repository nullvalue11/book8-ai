import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// MINIMAL TEST HANDLER - Proves routing works
export async function GET(request, { params }) {
  const url = new URL(request.url)
  const searchParams = Object.fromEntries(url.searchParams.entries())

  return NextResponse.json({
    ok: true,
    source: 'availability-test',
    handle: params?.handle ?? null,
    query: searchParams,
    timestamp: new Date().toISOString(),
    message: '✅ Dynamic route /api/public/[handle]/availability is working!',
  })
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
