/**
 * Ops Idempotency Handler
 * 
 * Ensures ops operations are idempotent by storing execution results
 * and returning cached results for duplicate requestIds.
 */

/**
 * Check if a request has already been processed
 * @param {Db} db - MongoDB database
 * @param {string} requestId - Request ID
 * @returns {Promise<object|null>} Cached result or null if not found
 */
export async function getCachedResult(db, requestId) {
  const collection = db.collection('ops_executions')
  
  // Ensure unique index on requestId
  try {
    await collection.createIndex({ requestId: 1 }, { unique: true })
  } catch (e) {
    // Index may already exist
  }
  
  const cached = await collection.findOne({ requestId })
  return cached ? cached.response : null
}

/**
 * Store execution result for idempotency
 * @param {Db} db - MongoDB database
 * @param {string} requestId - Request ID
 * @param {object} response - Response to cache
 * @returns {Promise<void>}
 */
export async function storeResult(db, requestId, response) {
  const collection = db.collection('ops_executions')
  
  await collection.insertOne({
    requestId,
    response,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days TTL
  })
}

/**
 * Check if this is a duplicate request (for locking)
 * @param {Db} db - MongoDB database
 * @param {string} requestId - Request ID
 * @returns {Promise<boolean>} True if request is already being processed
 */
export async function acquireLock(db, requestId) {
  const collection = db.collection('ops_locks')
  
  // Ensure unique index and TTL
  try {
    await collection.createIndex({ requestId: 1 }, { unique: true })
    await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 }) // 5 min TTL
  } catch (e) {
    // Indexes may already exist
  }
  
  try {
    await collection.insertOne({
      requestId,
      createdAt: new Date()
    })
    return true // Lock acquired
  } catch (e) {
    if (e.code === 11000) {
      return false // Duplicate - lock not acquired
    }
    throw e
  }
}

/**
 * Release a lock
 * @param {Db} db - MongoDB database
 * @param {string} requestId - Request ID
 * @returns {Promise<void>}
 */
export async function releaseLock(db, requestId) {
  const collection = db.collection('ops_locks')
  await collection.deleteOne({ requestId })
}
