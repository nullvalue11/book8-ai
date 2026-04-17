/**
 * BOO-109A — Welcome email on business signup (founder-signed, transactional).
 * Fire async from phone-setup completion and inherited-subscription register; idempotent via notifications.sent.
 */

import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'
import {
  getCoreApiBaseUrl,
  getCoreApiInternalHeadersJson,
  hasCoreApiInternalCredentials
} from '@/lib/core-api-internal'
import { buildWelcomeEmailForLocale } from '@/lib/email/welcomeEmailI18n'
import { normalizePrimaryLanguage } from '@/lib/primary-languages'
import {
  formatE164ForDisplay,
  businessEligibleForWelcomeEmail,
  buildSupportedLanguagesDisplay,
  formatTrialEndForLocale,
  resolveOwnerFirstName
} from '@/lib/welcomeEmailCore'
import { deliverWelcomeEmailAndStamp } from '@/lib/welcomeEmailResendDispatch'
import { sendResendEmail } from '@/lib/resendSend'

export {
  formatE164ForDisplay,
  businessEligibleForWelcomeEmail,
  buildSupportedLanguagesDisplay,
  formatTrialEndForLocale,
  resolveOwnerFirstName
} from '@/lib/welcomeEmailCore'

/** @param {string} businessId */
async function fetchCoreBusinessPhoneFields(businessId) {
  if (!hasCoreApiInternalCredentials()) return null
  try {
    const baseUrl = getCoreApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/businesses/${encodeURIComponent(businessId)}`, {
      method: 'GET',
      headers: getCoreApiInternalHeadersJson(),
      cache: 'no-store'
    })
    if (!res.ok) return null
    const data = await res.json()
    const biz = data.business ?? data.data ?? data
    return {
      assignedTwilioNumber: biz.assignedTwilioNumber ?? biz.assigned_twilio_number ?? null,
      forwardingEnabled: !!biz.forwardingEnabled,
      forwardingFrom: Array.isArray(biz.forwardingFrom) ? biz.forwardingFrom : [],
      phoneNumber: biz.phoneNumber ?? null
    }
  } catch {
    return null
  }
}

function appOrigin() {
  return (env.BASE_URL || '').replace(/\/$/, '') || 'https://book8.io'
}

/**
 * @param {import('mongodb').Db} database
 * @param {string} businessId
 * @param {{ forceFire?: boolean }} [opts]
 */
export async function sendWelcomeEmailToBusiness(database, businessId, opts = {}) {
  const { forceFire = false } = opts
  const collection = database.collection(COLLECTION_NAME)

  const business = await collection.findOne({
    $or: [{ businessId }, { id: businessId }]
  })
  if (!business) {
    console.warn('[welcome-email] business not found', businessId)
    return { ok: false, skipped: 'no_business' }
  }

  const bid = business.businessId || business.id

  const alreadySent = business.notifications?.sent?.some((n) => n?.type === 'welcome-email')
  if (alreadySent && !forceFire) {
    return { ok: true, skipped: 'already_sent' }
  }

  if (!businessEligibleForWelcomeEmail(business)) {
    return { ok: true, skipped: 'not_eligible' }
  }

  const owner = business.ownerUserId
    ? await database.collection('users').findOne({ id: business.ownerUserId })
    : null
  const to = owner?.email || business.ownerEmail
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    console.warn('[welcome-email] no recipient email', bid)
    return { ok: false, skipped: 'no_email' }
  }

  const core = await fetchCoreBusinessPhoneFields(bid)
  const assignedRaw =
    core?.assignedTwilioNumber ||
    business.assignedTwilioNumber ||
    business.book8Number ||
    business.phoneNumber ||
    null
  const forwardingEnabled = core?.forwardingEnabled ?? !!business.forwardingEnabled
  const forwardingFrom = (core?.forwardingFrom?.length ? core.forwardingFrom : business.forwardingFrom) || []
  const forwardingFromDisplay = formatE164ForDisplay(forwardingFrom[0]) || forwardingFrom[0] || null
  const existingBusinessDisplay =
    formatE164ForDisplay(business.existingBusinessNumber) || business.existingBusinessNumber || null

  const locale = normalizePrimaryLanguage(business.primaryLanguage)
  const firstName = resolveOwnerFirstName(owner, business)
  const trialEndsFormatted = formatTrialEndForLocale(business.subscription?.trialEnd, locale)
  const languagesDisplay = buildSupportedLanguagesDisplay(business)

  const templateInput = {
    appOrigin: appOrigin(),
    firstName,
    locale,
    forwardingEnabled,
    assignedRaw: typeof assignedRaw === 'string' ? assignedRaw : null,
    assignedDisplay: formatE164ForDisplay(assignedRaw),
    forwardingFromDisplay,
    existingBusinessDisplay,
    languagesDisplay,
    trialEndsFormatted
  }

  const { subject, html } = buildWelcomeEmailForLocale(templateInput)

  const plainLines = [
    firstName === 'there' ? 'Hey there,' : `Hey ${firstName},`,
    '',
    templateInput.assignedDisplay
      ? `Book8 number: ${templateInput.assignedDisplay}`
      : 'Phone setup: in progress',
    `Languages: ${languagesDisplay}`,
    trialEndsFormatted ? `Trial ends: ${trialEndsFormatted}` : '',
    '',
    `Dashboard: ${new URL('/dashboard', appOrigin()).toString()}`,
    '',
    '— Wais, Founder, Book8'
  ].filter(Boolean)

  if (!env.RESEND_API_KEY) {
    console.warn('[welcome-email] RESEND_API_KEY missing')
    return { ok: false, skipped: 'no_resend' }
  }

  const sendPayload = {
    from: env.WELCOME_EMAIL_FROM,
    to,
    reply_to: env.EMAIL_REPLY_TO,
    subject,
    html,
    text: plainLines.join('\n')
  }

  const resendSend = async (payload) => {
    const { Resend } = await import('resend')
    const resend = new Resend(env.RESEND_API_KEY)
    const out = await sendResendEmail(resend, payload)
    if (!out.ok) {
      return {
        data: null,
        error: { message: out.error, statusCode: out.statusCode, name: out.name }
      }
    }
    return { data: { id: out.id }, error: null }
  }

  return deliverWelcomeEmailAndStamp({
    collection,
    businessDoc: business,
    sendPayload,
    resendSend,
    logAddresses: { to, from: env.WELCOME_EMAIL_FROM }
  })
}

/**
 * Non-blocking helper for route handlers.
 * @param {import('mongodb').Db} database
 * @param {string} businessId
 * @param {{ forceFire?: boolean }} [opts]
 */
export function fireWelcomeEmailAsync(database, businessId, opts) {
  void sendWelcomeEmailToBusiness(database, businessId, opts || {}).catch((err) => {
    console.error('[welcome-email] async error:', err?.message || err)
  })
}
