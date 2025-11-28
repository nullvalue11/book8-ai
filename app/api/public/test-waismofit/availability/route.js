import { NextResponse } from 'next/server'

export async function GET(request) {
  return NextResponse.json({
    ok: true,
    message: 'Static route test working!',
    path: '/api/public/test-waismofit/availability'
  })
}
