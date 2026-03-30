/**
 * Env module smoke tests (Node native runner; Jest does not load app ESM cleanly).
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

// Avoid EnvValidationError when host shell has NODE_ENV=production + DEBUG_LOGS=true
if (process.env.NODE_ENV === 'production' && process.env.DEBUG_LOGS === 'true') {
  process.env.DEBUG_LOGS = 'false'
}

let env
let debugLog
let isFeatureEnabled

before(async () => {
  const mod = await import('../app/lib/env.js')
  env = mod.env
  debugLog = mod.debugLog
  isFeatureEnabled = mod.isFeatureEnabled
})

describe('Environment Configuration', () => {
  it('exports configuration object', () => {
    assert.ok(env)
    assert.equal(typeof env, 'object')
  })

  it('exposes required core keys', () => {
    assert.ok('NODE_ENV' in env)
    assert.ok('IS_PRODUCTION' in env)
    assert.ok('IS_DEVELOPMENT' in env)
    assert.ok('BASE_URL' in env)
    assert.ok('MONGO_URL' in env)
    assert.ok('DB_NAME' in env)
    assert.ok('JWT_SECRET' in env)
    assert.ok('RESET_TOKEN_SECRET' in env)
    assert.ok('RESET_TOKEN_TTL_MINUTES' in env)
    assert.ok('FEATURES' in env)
    assert.ok('RESCHEDULE' in env.FEATURES)
    assert.ok('GUEST_TZ' in env.FEATURES)
    assert.ok('DEBUG_LOGS' in env)
  })

  it('does not expose raw process.env passthrough', () => {
    assert.ok(!('PATH' in env))
    assert.ok(!('HOME' in env))
    assert.ok(!('USER' in env))
  })

  it('debugLog is callable', () => {
    assert.equal(typeof debugLog, 'function')
    assert.doesNotThrow(() => debugLog('test'))
  })

  it('isFeatureEnabled returns boolean', () => {
    assert.equal(typeof isFeatureEnabled, 'function')
    assert.equal(typeof isFeatureEnabled('RESCHEDULE'), 'boolean')
    assert.equal(typeof isFeatureEnabled('GUEST_TZ'), 'boolean')
  })

  it('value types', () => {
    assert.equal(typeof env.NODE_ENV, 'string')
    assert.equal(typeof env.IS_PRODUCTION, 'boolean')
    assert.equal(typeof env.IS_DEVELOPMENT, 'boolean')
    assert.equal(typeof env.BASE_URL, 'string')
    assert.equal(typeof env.MONGO_URL, 'string')
    assert.equal(typeof env.DB_NAME, 'string')
    assert.equal(typeof env.JWT_SECRET, 'string')
    assert.equal(typeof env.RESET_TOKEN_TTL_MINUTES, 'number')
    assert.equal(typeof env.DEBUG_LOGS, 'boolean')
  })
})
