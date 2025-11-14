import { NextResponse } from 'next/server'

export async function GET(request) {
  return NextResponse.json({
    ok: true,
    route: 'health',
    timestamp: new Date().toISOString(),
    message: '✅ /api/health is working!'
  })
}
