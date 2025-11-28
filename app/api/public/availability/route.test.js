import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// WORKAROUND: Using query parameter instead of dynamic route segment
// Access as: /api/public/availability?handle=waismofit&date=...
export async function GET(request) {
  const url = new URL(request.url)
  const handle = url.searchParams.get('handle')
  const date = url.searchParams.get('date')
  const tz = url.searchParams.get('tz')

  if (!handle) {
    return NextResponse.json({
      ok: false,
      error: 'Missing handle parameter'
    }, { status: 400 })
  }

  // MINIMAL TEST - Will restore full logic after confirming this works
  return NextResponse.json({
    ok: true,
    source: 'availability-query-param-workaround',
    handle,
    query: {
      date,
      tz
    },
    timestamp: new Date().toISOString(),
    message: '✅ Availability endpoint working with query params!',
  })
}
