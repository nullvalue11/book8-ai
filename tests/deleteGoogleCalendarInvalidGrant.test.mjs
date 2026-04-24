/**
 * BOO-113-CLEANUP-B — invalid_grant from Google Calendar delete → users.google.needsReconnect
 * (Helpers are what `deleteGoogleCalendarEventForBusiness` uses in its catch block.)
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  isInvalidGrantGoogleError,
  markUserGoogleNeedsReconnect
} from '../app/lib/bookingCalendarGcal.js'

describe('isInvalidGrantGoogleError', () => {
  it('is true for invalid_grant message', () => {
    assert.strictEqual(
      isInvalidGrantGoogleError(new Error('invalid_grant: Token has been revoked')),
      true
    )
  })

  it('is true for response status 401', () => {
    const err = new Error('nope')
    err.response = { status: 401 }
    assert.strictEqual(isInvalidGrantGoogleError(err), true)
  })

  it('is true for code 401', () => {
    const err = new Error('nope')
    err.code = 401
    assert.strictEqual(isInvalidGrantGoogleError(err), true)
  })

  it('is false for unrelated errors', () => {
    assert.strictEqual(isInvalidGrantGoogleError(new Error('not found')), false)
    assert.strictEqual(isInvalidGrantGoogleError(null), false)
  })
})

describe('markUserGoogleNeedsReconnect', () => {
  it('updates users with needsReconnect and lastError', async () => {
    const ops = []
    const database = {
      collection(name) {
        assert.strictEqual(name, 'users')
        return {
          async updateOne(filter, update) {
            ops.push({ filter, update })
            return { modifiedCount: 1 }
          }
        }
      }
    }
    await markUserGoogleNeedsReconnect(database, 'owner-xyz')
    assert.strictEqual(ops.length, 1)
    assert.deepStrictEqual(ops[0].filter, { id: 'owner-xyz' })
    assert.strictEqual(ops[0].update.$set['google.needsReconnect'], true)
    assert.strictEqual(typeof ops[0].update.$set['google.lastError'], 'string')
  })
})

describe('invalid_grant → needsReconnect path (same as deleteGoogleCalendarEventForBusiness catch)', () => {
  it('after a mocked Google invalid_grant error shape, persists needsReconnect on owner', async () => {
    const googleErr = new Error('invalid_grant')
    googleErr.response = { status: 401, data: {} }
    assert.strictEqual(isInvalidGrantGoogleError(googleErr), true)

    const ownerId = 'owner-from-delete-catch'
    const ops = []
    const database = {
      collection(name) {
        assert.strictEqual(name, 'users')
        return {
          async updateOne(filter, update) {
            ops.push({ filter, update })
            return { modifiedCount: 1 }
          }
        }
      }
    }
    await markUserGoogleNeedsReconnect(database, ownerId)
    assert.deepStrictEqual(ops[0].filter, { id: ownerId })
    assert.strictEqual(ops[0].update.$set['google.needsReconnect'], true)
  })
})
