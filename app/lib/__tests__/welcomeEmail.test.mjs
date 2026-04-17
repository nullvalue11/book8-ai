/**
 * BOO-109A — welcome email Resend path: `result.error` check before DB stamp.
 * Node native runner (same pattern as tests/env-config.test.mjs / welcomeEmailCore.test.mjs).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('deliverWelcomeEmailAndStamp', async () => {
  const { deliverWelcomeEmailAndStamp } = await import(
    pathToFileURL(join(__dirname, '../welcomeEmailResendDispatch.js')).href
  )

  const businessDoc = { _id: '507f1f77bcf86cd799439011' }
  const sendPayload = { from: 'a@b.test', to: 'c@d.test', subject: 's', html: '<p>x</p>' }
  const logAddresses = { to: 'c@d.test', from: 'a@b.test' }

  it('success: updateOne only after Resend returns without result.error', async () => {
    let updateCalls = 0
    const collection = {
      updateOne: async () => {
        updateCalls += 1
        return { acknowledged: true }
      }
    }

    const out = await deliverWelcomeEmailAndStamp({
      collection,
      businessDoc,
      sendPayload,
      logAddresses,
      resendSend: async () => ({ data: { id: 're_ok' }, error: null })
    })

    assert.deepEqual(out, { ok: true, sent: true, messageId: 're_ok' })
    assert.equal(updateCalls, 1)
  })

  it('API error shape: no DB stamp when result.error is set', async () => {
    let updateCalls = 0
    const collection = {
      updateOne: async () => {
        updateCalls += 1
        return { acknowledged: true }
      }
    }

    const out = await deliverWelcomeEmailAndStamp({
      collection,
      businessDoc,
      sendPayload,
      logAddresses,
      resendSend: async () => ({
        data: null,
        error: {
          name: 'validation_error',
          message: 'Invalid from address',
          statusCode: 422
        }
      })
    })

    assert.deepEqual(out, {
      ok: false,
      error: 'Invalid from address',
      statusCode: 422
    })
    assert.equal(updateCalls, 0)
  })

  it('thrown exception from resendSend: no DB stamp', async () => {
    let updateCalls = 0
    const collection = {
      updateOne: async () => {
        updateCalls += 1
        return { acknowledged: true }
      }
    }

    const out = await deliverWelcomeEmailAndStamp({
      collection,
      businessDoc,
      sendPayload,
      logAddresses,
      resendSend: async () => {
        throw new Error('network blew up')
      }
    })

    assert.deepEqual(out, { ok: false, error: 'network blew up' })
    assert.equal(updateCalls, 0)
  })
})
