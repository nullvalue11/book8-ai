/**
 * Dead-letter records for failed core-api /internal/subscription-sync calls (BOO-44B).
 * Native MongoDB — this repo does not use Mongoose.
 *
 * @typedef {import('mongodb').Db} Db
 */

export const SYNC_FAILURES_COLLECTION = 'sync_failures'

function normalizeStripeId(value) {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value.id) return String(value.id)
  return String(value)
}

/**
 * @param {Db} database
 * @param {object} fields
 */
export async function recordSyncFailure(database, fields) {
  const {
    businessId,
    stripeSubscriptionId,
    stripeCustomerId,
    stripeEventId,
    subscriptionStatus,
    lastError,
    lastErrorStatus,
    source
  } = fields

  const col = database.collection(SYNC_FAILURES_COLLECTION)
  const now = new Date()
  const errStr =
    typeof lastError === 'string'
      ? lastError.slice(0, 8000)
      : String(lastError ?? 'unknown')

  const subId = stripeSubscriptionId != null ? String(stripeSubscriptionId) : null
  const custId = normalizeStripeId(stripeCustomerId)

  if (stripeEventId && businessId) {
    await col.updateOne(
      { stripeEventId, businessId },
      {
        $set: {
          businessId,
          stripeSubscriptionId: subId,
          stripeCustomerId: custId,
          subscriptionStatus: subscriptionStatus != null ? String(subscriptionStatus) : null,
          lastError: errStr,
          lastErrorStatus: lastErrorStatus ?? null,
          source: source != null ? String(source) : null,
          attemptedAt: now,
          resolved: false,
          updatedAt: now
        },
        $inc: { attemptCount: 1 },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    )
    return
  }

  await col.insertOne({
    businessId,
    stripeSubscriptionId: subId,
    stripeCustomerId: custId,
    stripeEventId: stripeEventId != null ? String(stripeEventId) : null,
    subscriptionStatus: subscriptionStatus != null ? String(subscriptionStatus) : null,
    lastError: errStr,
    lastErrorStatus: lastErrorStatus ?? null,
    source: source != null ? String(source) : null,
    attemptedAt: now,
    attemptCount: 1,
    resolved: false,
    createdAt: now,
    updatedAt: now
  })
}

/**
 * Best-effort indexes for reconciliation queries (BOO-46A).
 * @param {import('mongodb').Collection} collection
 */
export async function ensureSyncFailureIndexes(collection) {
  await collection.createIndex({ stripeEventId: 1, businessId: 1 })
  await collection.createIndex({ resolved: 1, attemptedAt: 1 })
  await collection.createIndex({ businessId: 1 })
}
