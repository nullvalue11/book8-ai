/**
 * BOO-109A — welcome email pure helpers
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('welcomeEmailCore', async () => {
  const mod = await import(pathToFileURL(join(__dirname, '../app/lib/welcomeEmailCore.js')).href)

  it('formatE164ForDisplay formats NANP +1', () => {
    assert.equal(mod.formatE164ForDisplay('+14165550123'), '+1 (416) 555-0123')
    assert.equal(mod.formatE164ForDisplay('  '), null)
  })

  it('businessEligibleForWelcomeEmail respects subscription', () => {
    assert.equal(mod.businessEligibleForWelcomeEmail(null), false)
    assert.equal(
      mod.businessEligibleForWelcomeEmail({
        subscription: { status: 'trialing' }
      }),
      true
    )
    assert.equal(
      mod.businessEligibleForWelcomeEmail({
        subscription: { status: 'none' },
        plan: 'growth',
        features: { billingEnabled: true }
      }),
      true
    )
    assert.equal(
      mod.businessEligibleForWelcomeEmail({
        subscription: { status: 'none', trialEnd: '2026-05-01T00:00:00.000Z' }
      }),
      false
    )
  })

  it('resolveOwnerFirstName falls back to there', () => {
    assert.equal(mod.resolveOwnerFirstName({}, { ownerEmail: 'a+b@c.com' }), 'there')
    assert.equal(mod.resolveOwnerFirstName({ name: 'Wais Test' }, {}), 'Wais')
  })

  it('buildSupportedLanguagesDisplay adds multilingual codes', () => {
    const s = mod.buildSupportedLanguagesDisplay({
      primaryLanguage: 'en',
      multilingualEnabled: true
    })
    assert.match(s, /EN/)
    assert.match(s, /FR/)
  })
})
