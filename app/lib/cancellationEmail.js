/**
 * Resend emails for the BOO-CANCEL-1 cancel/restore feature.
 *
 * Four templates:
 *   1. sendImmediateCancelWithRefundEmail   — Path A (immediate cancel + full refund)
 *   2. sendCancelAtPeriodEndEmail           — Path B (cancel scheduled at period end)
 *   3. sendSubscriptionRestoredEmail        — Restore (canceled-at-period-end → reactivated)
 *   4. sendEndOfAccessEmail                 — Sent on customer.subscription.deleted webhook
 */

import { env } from '@/lib/env'
import { sendResendEmail } from '@/lib/resendSend'
import {
  buildImmediateCancelWithRefundHtml,
  buildCancelAtPeriodEndHtml,
  buildSubscriptionRestoredHtml,
  buildEndOfAccessHtml,
  formatDate,
  subjects
} from '@/lib/cancellationEmailCore'

function baseUrl() {
  return (env.BASE_URL || '').replace(/\/$/, '') || 'https://book8.io'
}

async function sendIfConfigured({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !to) {
    return { sent: false, reason: 'no_key_or_recipient' }
  }
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)
    const out = await sendResendEmail(resend, {
      from: env.EMAIL_FROM,
      to,
      reply_to: env.EMAIL_REPLY_TO,
      subject,
      html,
      text: text || undefined
    })
    if (!out.ok) {
      console.error('[cancellationEmail]', subject, out.error, out.statusCode, out.name)
      return { sent: false, error: out.error }
    }
    return { sent: true, id: out.id }
  } catch (e) {
    console.error('[cancellationEmail]', subject, e?.message || e)
    return { sent: false, error: e?.message }
  }
}

export async function sendImmediateCancelWithRefundEmail({
  to,
  businessName,
  refundAmountCents,
  refundCurrency = 'USD'
}) {
  const html = buildImmediateCancelWithRefundHtml({
    businessName,
    refundAmountCents,
    refundCurrency,
    baseUrl: baseUrl()
  })
  return sendIfConfigured({
    to,
    subject: subjects.immediateCancelWithRefund,
    html
  })
}

export async function sendCancelAtPeriodEndEmail({
  to,
  businessName,
  currentPeriodEnd
}) {
  const html = buildCancelAtPeriodEndHtml({
    businessName,
    currentPeriodEnd,
    baseUrl: baseUrl()
  })
  return sendIfConfigured({
    to,
    subject: subjects.cancelAtPeriodEnd(formatDate(currentPeriodEnd)),
    html
  })
}

export async function sendSubscriptionRestoredEmail({
  to,
  businessName,
  currentPeriodEnd
}) {
  const html = buildSubscriptionRestoredHtml({
    businessName,
    currentPeriodEnd,
    baseUrl: baseUrl()
  })
  return sendIfConfigured({
    to,
    subject: subjects.subscriptionRestored,
    html
  })
}

export async function sendEndOfAccessEmail({ to, businessName }) {
  const html = buildEndOfAccessHtml({
    businessName,
    baseUrl: baseUrl()
  })
  return sendIfConfigured({
    to,
    subject: subjects.endOfAccess,
    html
  })
}
