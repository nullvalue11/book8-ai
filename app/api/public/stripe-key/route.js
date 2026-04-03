import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Public Stripe publishable key for Elements (safe to expose). */
export async function GET() {
  const key =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || env.STRIPE?.PUBLISHABLE_KEY || null
  return NextResponse.json({ ok: !!key, publishableKey: key })
}
