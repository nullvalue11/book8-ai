/**
 * BOO-CANCEL-1B — cancellation email helpers
 * (Node native runner — same pattern as env-config.test.mjs)
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

const placeholders = {
  JWT_SECRET: 'jest-jwt-secret-min-32-chars-ok!!',
  OPS_CONSOLE_USER: 'jest-ops-user',
  OPS_CONSOLE_PASS: 'jest-ops-pass',
  MONGO_URL: 'mongodb://127.0.0.1:27017/jest',
  NEXT_PUBLIC_BASE_URL: 'http://localhost:3000',
  STRIPE_SECRET_KEY: 'sk_test_jest_placeholder',
  RESEND_API_KEY: 're_jest_placeholder'
}

for (const [key, value] of Object.entries(placeholders)) {
  if (!process.env[key] || String(process.env[key]).trim() === '') {
    process.env[key] = value
  }
}

if (process.env.NODE_ENV === 'production' && process.env.DEBUG_LOGS === 'true') {
  process.env.DEBUG_LOGS = 'false'
}

import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mod

before(async () => {
  mod = await import(
    pathToFileURL(join(__dirname, '../app/lib/cancellationEmailCore.js')).href
  )
})

describe('cancellationEmailCore helpers', () => {
  it('escapes HTML special characters', () => {
    assert.equal(mod.escapeHtml('<script>'), '&lt;script&gt;')
    assert.equal(
      mod.escapeHtml('"quoted" & \'single\''),
      '&quot;quoted&quot; &amp; &#39;single&#39;'
    )
    assert.equal(mod.escapeHtml(null), '')
    assert.equal(mod.escapeHtml(undefined), '')
  })

  it('formats refund cents as dollar amount + currency', () => {
    assert.equal(mod.formatCents(9900, 'usd'), '99.00 USD')
    assert.equal(mod.formatCents(0, 'cad'), '0.00 CAD')
    assert.equal(mod.formatCents(12345), '123.45 USD')
    assert.equal(mod.formatCents(NaN, 'usd'), '0.00 USD')
  })

  it('formats date inputs (string + Date)', () => {
    assert.match(mod.formatDate('2026-12-15T00:00:00.000Z'), /December|Dec/)
    assert.match(mod.formatDate(new Date('2026-01-05T00:00:00.000Z')), /2026/)
    assert.equal(mod.formatDate(null), '')
    assert.equal(mod.formatDate('not-a-date'), '')
  })

  it('builds Path A immediate-cancel-with-refund HTML body', () => {
    const html = mod.buildImmediateCancelWithRefundHtml({
      businessName: 'Acme <Co>',
      refundAmountCents: 9900,
      refundCurrency: 'usd',
      baseUrl: 'https://book8.io'
    })
    assert.match(html, /Acme &lt;Co&gt;/)
    assert.match(html, /99\.00 USD/)
    assert.match(html, /cancelled immediately/)
    assert.match(html, /full refund/)
  })

  it('builds Path B cancel-at-period-end HTML body', () => {
    const html = mod.buildCancelAtPeriodEndHtml({
      businessName: 'Acme',
      currentPeriodEnd: '2026-12-15T00:00:00.000Z',
      baseUrl: 'https://book8.io'
    })
    assert.match(html, /set to cancel on/)
    assert.match(html, /December|Dec/)
    assert.match(html, /restore your subscription/)
  })

  it('builds restore HTML body', () => {
    const html = mod.buildSubscriptionRestoredHtml({
      businessName: 'Acme',
      currentPeriodEnd: '2026-12-15T00:00:00.000Z',
      baseUrl: 'https://book8.io'
    })
    assert.match(html, /restored/)
    assert.match(html, /December|Dec/)
  })

  it('builds end-of-access HTML body', () => {
    const html = mod.buildEndOfAccessHtml({
      businessName: 'Acme',
      baseUrl: 'https://book8.io'
    })
    assert.match(html, /subscription has ended/)
    assert.match(html, /24 hours/)
  })
})
