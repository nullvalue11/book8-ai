/**
 * Resend emails for Growth plan trial lifecycle (Stripe webhook–driven).
 */

import { env } from '@/lib/env'
import { sendResendEmail } from '@/lib/resendSend'

function baseUrl() {
  return (env.BASE_URL || '').replace(/\/$/, '') || 'https://book8.io'
}

async function sendIfConfigured({ to, subject, html, text }) {
  if (!env.RESEND_API_KEY || !to) return { sent: false, reason: 'no_key_or_recipient' }
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
      console.error('[trialLifecycleEmail]', subject, out.error, out.statusCode, out.name)
      return { sent: false, error: out.error }
    }
    return { sent: true }
  } catch (e) {
    console.error('[trialLifecycleEmail]', subject, e?.message || e)
    return { sent: false, error: e?.message }
  }
}

export async function sendTrialStartedEmail({
  to,
  businessName,
  trialEndDate,
  phoneNumber,
  handle,
  calendarProvider
}) {
  const bu = baseUrl()
  const phone = phoneNumber || '— (assigning)'
  const book = handle ? `${bu}/b/${handle}` : `${bu}/dashboard`
  const cal = calendarProvider || 'Not connected yet'
  const html = `
<p>Hi ${businessName},</p>
<p>Welcome to Book8-AI! Your ${env.TRIAL_PERIOD_DAYS ?? 14}-day free trial of the Growth plan is now active.</p>
<p><strong>Here's what's set up for you:</strong></p>
<ul>
<li>Phone number: ${phone}</li>
<li>Booking page: ${book}</li>
<li>Calendar: ${cal}</li>
</ul>
<p>Your card will not be charged until <strong>${trialEndDate}</strong>. If Book8-AI isn't right for your business, cancel anytime before then.</p>
<p><strong>What to do next:</strong></p>
<ol>
<li>Share your phone number with customers</li>
<li>Share your booking link on social media</li>
<li>Watch the bookings roll in on your dashboard</li>
</ol>
<p>Questions? Reply to this email or visit <a href="${bu}/dashboard">${bu}/dashboard</a>.</p>
<p>— The Book8-AI Team</p>`
  return sendIfConfigured({
    to,
    subject: `Your ${env.TRIAL_PERIOD_DAYS ?? 14}-day free trial has started!`,
    html
  })
}

export async function sendTrialEndingEmail({ to, businessName, trialEndDate }) {
  const bu = baseUrl()
  const html = `
<p>Hi ${businessName},</p>
<p>Your ${env.TRIAL_PERIOD_DAYS ?? 14}-day free trial ends on <strong>${trialEndDate}</strong>. After that, your Growth plan will automatically continue at $99/month.</p>
<p>Your trial so far: check your <a href="${bu}/dashboard">dashboard</a> for calls answered and appointments booked.</p>
<p>No action needed — your AI receptionist will keep working without interruption.</p>
<p>Want to cancel? Go to <a href="${bu}/dashboard/settings/billing">${bu}/dashboard/settings/billing</a> before ${trialEndDate}.</p>
<p>— The Book8-AI Team</p>`
  return sendIfConfigured({
    to,
    subject: 'Your Book8-AI trial ends in 3 days',
    html
  })
}

export async function sendTrialConvertedEmail({ to, businessName }) {
  const bu = baseUrl()
  const html = `
<p>Hi ${businessName},</p>
<p>Your free trial has ended and your Growth plan is now active at $99/month. Thank you for choosing Book8-AI!</p>
<p>Your AI receptionist is answering calls 24/7. No changes needed — everything keeps working.</p>
<p>Manage your subscription anytime at <a href="${bu}/dashboard/settings/billing">${bu}/dashboard/settings/billing</a>.</p>
<p>— The Book8-AI Team</p>`
  return sendIfConfigured({
    to,
    subject: "You're officially on the Growth plan!",
    html
  })
}

export async function sendPaymentFailedEmail({ to, businessName }) {
  const bu = baseUrl()
  const html = `
<p>Hi ${businessName || 'there'},</p>
<p>We couldn't charge your card for your Book8-AI subscription. Stripe will retry automatically — please update your payment method so your service isn't interrupted.</p>
<p><a href="${bu}/dashboard/settings/billing">Update payment method →</a></p>
<p>— The Book8-AI Team</p>`
  return sendIfConfigured({
    to,
    subject: 'Book8-AI — payment failed',
    html
  })
}
