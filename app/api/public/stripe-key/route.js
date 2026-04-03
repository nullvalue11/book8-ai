import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Public Stripe publishable key for Elements (safe to expose). */
export async function GET() {
  const key = env.STRIPE_PUBLISHABLE_KEY_FOR_ELEMENTS
  return NextResponse.json({ ok: !!key, publishableKey: key })
}
