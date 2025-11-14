import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// MINIMAL TEST HANDLER - Proves routing works
export async function GET(request, { params }) {
  console.log('[availability-test] HIT', {
    url: request.url,
    params,
    env: process.env.VERCEL_ENV || 'local',
  })

  const { handle } = params
  const url = new URL(request.url)

  return NextResponse.json({
    ok: true,
    source: 'availability-test',
    handle,
    query: Object.fromEntries(url.searchParams.entries()),
    timestamp: new Date().toISOString(),
    message: '✅ Dynamic route /api/public/[handle]/availability is working!'
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
