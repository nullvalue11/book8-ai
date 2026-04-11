/**
 * BOO-44B — dead-letter persistence for failed subscription-sync
 * (Node native runner — same pattern as env-config.test.mjs)
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

let recordSyncFailure
let SYNC_FAILURES_COLLECTION

before(async () => {
  const mod = await import('../app/models/SyncFailure.js')
  recordSyncFailure = mod.recordSyncFailure
  SYNC_FAILURES_COLLECTION = mod.SYNC_FAILURES_COLLECTION
})

describe('recordSyncFailure', () => {
  it('upserts on stripeEventId + businessId and increments attemptCount', async () => {
    const calls = []
    const updateOne = async (filter, update, options) => {
      calls.push({ filter, update, options })
    }
    const insertOne = async () => {
      throw new Error('should not insert')
    }
    const database = {
      collection: (name) => {
        assert.equal(name, SYNC_FAILURES_COLLECTION)
        return { updateOne, insertOne }
      }
    }

    await recordSyncFailure(database, {
      businessId: 'biz_a',
      stripeSubscriptionId: 'sub_x',
      stripeCustomerId: 'cus_y',
      stripeEventId: 'evt_123',
      subscriptionStatus: 'active',
      lastError: 'core down',
      lastErrorStatus: 502,
      source: 'checkout.session.completed'
    })

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].filter, { stripeEventId: 'evt_123', businessId: 'biz_a' })
    assert.deepEqual(calls[0].update.$inc, { attemptCount: 1 })
    assert.equal(calls[0].update.$set.businessId, 'biz_a')
    assert.equal(calls[0].update.$set.lastErrorStatus, 502)
    assert.equal(calls[0].update.$set.resolved, false)
    assert.deepEqual(calls[0].options, { upsert: true })
  })

  it('inserts a row when stripeEventId is absent', async () => {
    const inserted = []
    const database = {
      collection: () => ({
        updateOne: async () => {
          throw new Error('should not upsert')
        },
        insertOne: async (doc) => {
          inserted.push(doc)
        }
      })
    }

    await recordSyncFailure(database, {
      businessId: 'biz_b',
      stripeSubscriptionId: 'sub_z',
      lastError: 'missing_secret',
      source: 'manual'
    })

    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].businessId, 'biz_b')
    assert.equal(inserted[0].attemptCount, 1)
    assert.equal(inserted[0].stripeEventId, null)
  })

  it('inserts when stripeEventId is set but businessId is missing', async () => {
    const inserted = []
    const database = {
      collection: () => ({
        updateOne: async () => {
          throw new Error('should not upsert')
        },
        insertOne: async (doc) => {
          inserted.push(doc)
        }
      })
    }

    await recordSyncFailure(database, {
      stripeEventId: 'evt_only',
      stripeSubscriptionId: 'sub_1',
      lastError: 'test',
      source: 'edge'
    })

    assert.equal(inserted.length, 1)
    assert.equal(inserted[0].stripeEventId, 'evt_only')
  })

  it('normalizes expanded Stripe customer object', async () => {
    const calls = []
    const database = {
      collection: () => ({
        updateOne: async (filter, update) => {
          calls.push({ filter, update })
        },
        insertOne: async () => {}
      })
    }

    await recordSyncFailure(database, {
      businessId: 'biz_c',
      stripeEventId: 'evt_c',
      stripeCustomerId: { id: 'cus_from_expand', object: 'customer' },
      lastError: 'e',
      source: 'customer.subscription.updated'
    })

    assert.equal(calls[0].update.$set.stripeCustomerId, 'cus_from_expand')
  })
})
