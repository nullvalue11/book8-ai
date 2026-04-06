/**
 * Slack notifier for Ops Console events (BOO-78B).
 * Posts via Incoming Webhook. Set SLACK_OPS_WEBHOOK_URL in env.
 * Set SLACK_OPS_NOTIFICATIONS_ENABLED=false to silence without removing the webhook.
 * Set SLACK_OPS_INFO_NOTIFICATIONS=true for bootstrap success + signup noise.
 */

import { env } from '@/lib/env'

const SLACK_WEBHOOK = typeof env.SLACK_OPS_WEBHOOK_URL === 'string' ? env.SLACK_OPS_WEBHOOK_URL.trim() : ''
const ENABLED = env.SLACK_OPS_NOTIFICATIONS_ENABLED !== false

const COLORS = {
  critical: '#DC2626',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#6366F1'
}

function opsBaseUrl() {
  const b = env.BASE_URL || ''
  return b.replace(/\/$/, '')
}

/**
 * @param {{
 *   level?: 'critical' | 'warning' | 'success' | 'info',
 *   title: string,
 *   message: string,
 *   fields?: Array<{ label: string, value: string }>,
 *   actionUrl?: string | null,
 *   actionLabel?: string
 * }} opts
 */
export async function notifySlack({
  level = 'info',
  title,
  message,
  fields = [],
  actionUrl = null,
  actionLabel = 'View in Ops Console'
}) {
  if (!SLACK_WEBHOOK || !ENABLED) {
    if (env.DEBUG_LOGS) {
      console.log(`[slack-notifier] skipped (webhook=${!!SLACK_WEBHOOK}, enabled=${ENABLED})`)
    }
    return { skipped: true }
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title.slice(0, 150), emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: message.slice(0, 2900) }
    }
  ]

  if (fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${String(f.label).slice(0, 80)}*\n${String(f.value).slice(0, 1900)}`
      }))
    })
  }

  if (actionUrl) {
    const btn = {
      type: 'button',
      text: { type: 'plain_text', text: actionLabel.slice(0, 75) },
      url: actionUrl.slice(0, 2000)
    }
    if (level === 'critical') {
      btn.style = 'danger'
    } else {
      btn.style = 'primary'
    }
    blocks.push({
      type: 'actions',
      elements: [btn]
    })
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Book8 Ops · ${new Date().toISOString()}`
      }
    ]
  })

  try {
    const response = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachments: [
          {
            color: COLORS[level] || COLORS.info,
            blocks
          }
        ]
      })
    })

    if (!response.ok) {
      const t = await response.text().catch(() => '')
      console.error('[slack-notifier] Slack webhook failed:', response.status, t?.slice(0, 200))
      return { error: `HTTP ${response.status}` }
    }

    return { ok: true }
  } catch (err) {
    console.error('[slack-notifier] Error sending to Slack:', err?.message || err)
    return { error: err?.message || 'fetch failed' }
  }
}

function safePayloadSnippet(payload) {
  try {
    const s = JSON.stringify(payload, null, 2)
    return s.length > 500 ? `${s.slice(0, 500)}…` : s
  } catch {
    return String(payload).slice(0, 500)
  }
}

function toolErrStr(error) {
  if (error == null) return 'Unknown'
  if (typeof error === 'string') return error.slice(0, 500)
  if (typeof error === 'object' && error.message) return String(error.message).slice(0, 500)
  try {
    return JSON.stringify(error).slice(0, 500)
  } catch {
    return String(error).slice(0, 500)
  }
}

export const slackOps = {
  approvalPending: ({ toolName, businessId, requestId, payload }) =>
    notifySlack({
      level: 'critical',
      title: '🔴 Ops Approval Required',
      message: `*\`${toolName}\`* is waiting for approval.`,
      fields: [
        { label: 'Business', value: businessId || 'N/A' },
        { label: 'Request ID', value: String(requestId || 'N/A') },
        { label: 'Payload', value: '```' + safePayloadSnippet(payload) + '```' }
      ],
      actionUrl: `${opsBaseUrl()}/ops/requests`,
      actionLabel: 'Review & Approve'
    }),

  toolFailed: ({ toolName, businessId, error, requestId }) =>
    notifySlack({
      level: 'critical',
      title: '❌ Ops Tool Failed',
      message: `*\`${toolName}\`* failed during execution.`,
      fields: [
        { label: 'Business', value: businessId || 'N/A' },
        { label: 'Error', value: toolErrStr(error) },
        { label: 'Request ID', value: String(requestId || 'N/A') }
      ],
      actionUrl: requestId
        ? `${opsBaseUrl()}/ops/logs?requestId=${encodeURIComponent(String(requestId))}`
        : `${opsBaseUrl()}/ops/logs`,
      actionLabel: 'View Logs'
    }),

  voiceDiagnosticsFailed: ({ failedTargets, businessId }) =>
    notifySlack({
      level: 'critical',
      title: '📞 Voice Service Degraded',
      message: `Voice diagnostics found *${failedTargets.length}* unhealthy target(s).`,
      fields: [
        { label: 'Business', value: businessId || 'global' },
        {
          label: 'Failed',
          value: failedTargets.map((t) => t.name || t.target || t.url || '?').join(', ').slice(0, 1800)
        }
      ],
      actionUrl: `${opsBaseUrl()}/ops/tools`,
      actionLabel: 'Ops Tools'
    }),

  tenantBootstrapFailed: ({ businessId, error }) =>
    notifySlack({
      level: 'critical',
      title: '🚨 Tenant Bootstrap Failed',
      message: `Onboarding failed for *\`${businessId}\`*. Customer may be stuck.`,
      fields: [
        { label: 'Business', value: String(businessId) },
        { label: 'Error', value: toolErrStr(error) }
      ],
      actionUrl: `${opsBaseUrl()}/ops/tools`,
      actionLabel: 'Run Recovery'
    }),

  tenantBootstrapSucceeded: ({ businessId, name }) =>
    notifySlack({
      level: 'success',
      title: '✅ Tenant Online',
      message: `Bootstrap completed for *\`${businessId}\`*.`,
      fields: name ? [{ label: 'Name', value: String(name).slice(0, 200) }] : [],
      actionUrl: `${opsBaseUrl()}/ops/logs`,
      actionLabel: 'Ops Logs'
    }),

  tenantRecovery: ({ businessId, autoFix, issuesFound }) =>
    notifySlack({
      level: 'warning',
      title: autoFix ? '🔧 Tenant Auto-Recovered' : '🔍 Tenant Recovery Ran',
      message: `Recovery executed for *\`${businessId}\`*.`,
      fields: [
        { label: 'Auto-fix', value: autoFix ? 'Yes' : 'No' },
        { label: 'Issues found', value: String(issuesFound ?? 0) }
      ],
      actionUrl: `${opsBaseUrl()}/ops/logs`,
      actionLabel: 'View Logs'
    }),

  approvalGranted: ({ toolName, businessId, approvedBy, requestId }) =>
    notifySlack({
      level: 'success',
      title: '✅ Ops Approval Granted',
      message: `*\`${toolName}\`* was approved.`,
      fields: [
        { label: 'Business', value: businessId || 'N/A' },
        { label: 'Approved by', value: approvedBy || 'unknown' },
        { label: 'Request ID', value: String(requestId) }
      ],
      actionUrl: `${opsBaseUrl()}/ops/requests`,
      actionLabel: 'Requests'
    }),

  billingDiscrepancy: ({ businessId, expected, actual, discrepancyPercent }) =>
    notifySlack({
      level: 'warning',
      title: '💰 Billing Discrepancy Detected',
      message: `*\`${businessId}\`* has a billing mismatch.`,
      fields: [
        { label: 'Expected', value: String(expected) },
        { label: 'Actual', value: String(actual) },
        { label: 'Discrepancy', value: String(discrepancyPercent) }
      ],
      actionUrl: `${opsBaseUrl()}/ops/tools`,
      actionLabel: 'Ops Tools'
    }),

  newSignup: ({ email, name }) =>
    notifySlack({
      level: 'success',
      title: '🎉 New Signup',
      message: `*${name || email}* registered.`,
      fields: [{ label: 'Email', value: String(email) }]
    }),

  newBooking: ({ businessId, businessName, customerName, service, dateTime }) =>
    notifySlack({
      level: 'success',
      title: '📅 New Booking',
      message: `*${customerName}* booked *${service}* at *${businessName}*.`,
      fields: [
        { label: 'When', value: String(dateTime) },
        { label: 'Business', value: String(businessId) }
      ]
    }),

  phoneSetupFailed: ({ businessId, step, error }) =>
    notifySlack({
      level: 'critical',
      title: '📱 Phone Setup / Core Sync Failed',
      message: `*\`${step}\`* failed during phone setup.`,
      fields: [
        { label: 'Business', value: String(businessId || 'N/A') },
        { label: 'Error', value: toolErrStr(error) }
      ],
      actionUrl: `${opsBaseUrl()}/ops/tools`,
      actionLabel: 'Ops Tools'
    })
}
