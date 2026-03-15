/**
 * POST /api/billing/webhook
 *
 * Proxy for Stripe webhooks. Forwards the request to the canonical handler
 * at /api/webhooks/stripe so that either URL works in the Stripe Dashboard.
 *
 * Configure Stripe to send events to either:
 *   - https://your-domain.com/api/webhooks/stripe  (canonical)
 *   - https://your-domain.com/api/billing/webhook  (this proxy)
 */

import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const rawBody = await request.text()
    const stripeSignature = request.headers.get('stripe-signature')
    const baseUrl = env.BASE_URL || ''
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/stripe`

    if (!rawBody || !stripeSignature) {
      return NextResponse.json(
        { ok: false, error: 'Missing body or stripe-signature' },
        { status: 400 }
      )
    }

    if (!webhookUrl.startsWith('http')) {
      console.error('[billing/webhook] BASE_URL not set or invalid, cannot forward')
      return NextResponse.json(
        { ok: false, error: 'Webhook proxy misconfigured' },
        { status: 500 }
      )
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': stripeSignature
      },
      body: rawBody
    })

    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON' }))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    console.error('[billing/webhook] Proxy error:', e)
    return NextResponse.json(
      { ok: false, error: 'Webhook proxy failed' },
      { status: 500 }
    )
  }
}
