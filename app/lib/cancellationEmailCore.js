/**
 * Pure HTML/string builders for BOO-CANCEL-1B cancellation emails.
 *
 * Kept dependency-free (no `@/lib/env`, no SDKs) so it can be unit-tested with
 * the Node native test runner the same way `welcomeEmailCore.js` is.
 */

export function escapeHtml(input) {
  if (input === null || input === undefined) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatCents(amountCents, currency = 'USD') {
  const cents = Number.isFinite(amountCents) ? amountCents : 0
  const dollars = (cents / 100).toFixed(2)
  return `${dollars} ${String(currency || 'USD').toUpperCase()}`
}

export function formatDate(input) {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function trimBaseUrl(baseUrl) {
  return String(baseUrl || 'https://book8.io').replace(/\/$/, '')
}

export function buildImmediateCancelWithRefundHtml({
  businessName,
  refundAmountCents,
  refundCurrency = 'USD',
  baseUrl
}) {
  const bu = trimBaseUrl(baseUrl)
  const safeName = escapeHtml(businessName || 'there')
  const refundText = escapeHtml(formatCents(refundAmountCents, refundCurrency))
  return `
<p>Hi ${safeName},</p>
<p>Your Book8-AI subscription has been <strong>cancelled immediately</strong> and a full refund of <strong>${refundText}</strong> has been issued to your original payment method. Refunds typically settle within 5–10 business days.</p>
<p>Your AI receptionist has been turned off and your booking page is no longer live. We've kept a backup of your data for the next 24 hours in case you change your mind — after that it will be permanently removed.</p>
<p>If you'd like to come back later, you can sign up again any time at <a href="${bu}">${bu}</a>.</p>
<p>If you have a moment, reply to this email and let us know what we could do better. We read every response.</p>
<p>— The Book8-AI Team</p>`
}

export function buildCancelAtPeriodEndHtml({
  businessName,
  currentPeriodEnd,
  baseUrl
}) {
  const bu = trimBaseUrl(baseUrl)
  const safeName = escapeHtml(businessName || 'there')
  const endDate = formatDate(currentPeriodEnd)
  const billingUrl = `${bu}/dashboard/settings/billing`
  return `
<p>Hi ${safeName},</p>
<p>Your Book8-AI subscription is set to cancel on <strong>${escapeHtml(endDate || 'your next renewal date')}</strong>. You won't be charged again, and your AI receptionist will keep working until then.</p>
<p>Changed your mind? You can restore your subscription any time before that date from <a href="${billingUrl}">your billing settings</a>.</p>
<p>If you have a moment, reply to this email and let us know what we could do better.</p>
<p>— The Book8-AI Team</p>`
}

export function buildSubscriptionRestoredHtml({
  businessName,
  currentPeriodEnd,
  baseUrl
}) {
  const bu = trimBaseUrl(baseUrl)
  const safeName = escapeHtml(businessName || 'there')
  const endDate = formatDate(currentPeriodEnd)
  const billingUrl = `${bu}/dashboard/settings/billing`
  return `
<p>Hi ${safeName},</p>
<p>Welcome back! Your Book8-AI subscription has been <strong>restored</strong>${endDate ? ` and will renew on <strong>${escapeHtml(endDate)}</strong>` : ''}.</p>
<p>Your AI receptionist will continue to answer calls and book appointments without interruption.</p>
<p>Manage your subscription any time at <a href="${billingUrl}">${billingUrl}</a>.</p>
<p>— The Book8-AI Team</p>`
}

export function buildEndOfAccessHtml({ businessName, baseUrl }) {
  const bu = trimBaseUrl(baseUrl)
  const safeName = escapeHtml(businessName || 'there')
  return `
<p>Hi ${safeName},</p>
<p>Your Book8-AI subscription has ended and your AI receptionist has been turned off. Your booking page is no longer live.</p>
<p>We've kept a backup of your data for the next 24 hours in case you'd like to come back — after that it will be permanently removed.</p>
<p>You can sign up again any time at <a href="${bu}">${bu}</a>.</p>
<p>Thanks for trying Book8-AI. If you have a moment, reply to this email and let us know how we could have served you better.</p>
<p>— The Book8-AI Team</p>`
}

export const subjects = {
  immediateCancelWithRefund: 'Your Book8-AI subscription has been cancelled and refunded',
  cancelAtPeriodEnd: (endDate) =>
    `Your Book8-AI subscription will end ${endDate ? 'on ' + endDate : 'at the end of this period'}`,
  subscriptionRestored: 'Your Book8-AI subscription has been restored',
  endOfAccess: 'Your Book8-AI access has ended'
}
