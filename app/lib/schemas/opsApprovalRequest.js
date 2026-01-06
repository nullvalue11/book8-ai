/**
 * Ops Approval Requests Schema
 * 
 * Stores approval requests for high-risk tool executions.
 * Collection: ops_approval_requests
 * 
 * @module lib/schemas/opsApprovalRequest
 */

import crypto from 'crypto'

// =============================================================================
// TypeScript Types (JSDoc for IDE Support)
// =============================================================================

/**
 * @typedef {'pending' | 'approved' | 'rejected' | 'executed' | 'expired'} ApprovalStatus
 */

/**
 * @typedef {Object} OpsApprovalRequest
 * @property {string} requestId - Unique request identifier (UUID format)
 * @property {string} tool - Tool name to execute
 * @property {string} payloadHash - SHA256 hash of the payload for integrity
 * @property {object} payload - Original payload for execution
 * @property {object} plan - Execution plan from plan mode
 * @property {string} requestedBy - Who requested the execution
 * @property {ApprovalStatus} status - Current status
 * @property {string} [approvedBy] - Who approved the request
 * @property {Date} [approvedAt] - When it was approved
 * @property {string} [rejectedBy] - Who rejected the request
 * @property {Date} [rejectedAt] - When it was rejected
 * @property {string} [rejectionReason] - Why it was rejected
 * @property {Date} [executedAt] - When it was executed
 * @property {object} [result] - Execution result
 * @property {object} [error] - Execution error if failed
 * @property {object} meta - Additional metadata
 * @property {Date} createdAt - When request was created
 * @property {Date} expiresAt - When request expires (default: 24h)
 */

// =============================================================================
// Constants
// =============================================================================

export const COLLECTION_NAME = 'ops_approval_requests'

export const STATUS_VALUES = ['pending', 'approved', 'rejected', 'executed', 'expired']

export const DEFAULT_EXPIRY_HOURS = 24

// =============================================================================
// Index Definitions
// =============================================================================

export const INDEXES = [
  {
    key: { requestId: 1 },
    name: 'idx_requestId',
    unique: true,
    background: true
  },
  {
    key: { status: 1, createdAt: -1 },
    name: 'idx_status_createdAt',
    background: true
  },
  {
    key: { tool: 1, status: 1 },
    name: 'idx_tool_status',
    background: true
  },
  {
    key: { requestedBy: 1, createdAt: -1 },
    name: 'idx_requestedBy_createdAt',
    background: true
  },
  {
    key: { expiresAt: 1 },
    name: 'idx_expiresAt_ttl',
    expireAfterSeconds: 0, // TTL index - documents expire at expiresAt
    background: true
  }
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a UUID v4
 */
export function generateRequestId() {
  return crypto.randomUUID()
}

/**
 * Generate SHA256 hash of payload for integrity verification
 * @param {object} payload - The payload to hash
 * @returns {string} SHA256 hash
 */
export function hashPayload(payload) {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort())
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Verify payload hash matches
 * @param {object} payload - The payload to verify
 * @param {string} expectedHash - The expected hash
 * @returns {boolean}
 */
export function verifyPayloadHash(payload, expectedHash) {
  const actualHash = hashPayload(payload)
  return actualHash === expectedHash
}

/**
 * Create a new approval request
 * @param {object} input - Request input
 * @returns {OpsApprovalRequest}
 */
export function createApprovalRequest(input) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000)
  
  return {
    requestId: input.requestId || generateRequestId(),
    tool: input.tool,
    payloadHash: hashPayload(input.payload),
    payload: input.payload,
    plan: input.plan,
    requestedBy: input.requestedBy,
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    executedAt: null,
    result: null,
    error: null,
    meta: input.meta || {},
    createdAt: now,
    expiresAt
  }
}

/**
 * Validate an approval request status transition
 * @param {ApprovalStatus} currentStatus - Current status
 * @param {ApprovalStatus} newStatus - Desired new status
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    pending: ['approved', 'rejected', 'expired'],
    approved: ['executed', 'expired'],
    rejected: [], // Terminal state
    executed: [], // Terminal state
    expired: [] // Terminal state
  }
  
  const allowed = validTransitions[currentStatus] || []
  
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowed.join(', ') || 'none'}`
    }
  }
  
  return { valid: true }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Ensure indexes exist on the collection
 * @param {import('mongodb').Db} db - MongoDB database instance
 */
export async function ensureIndexes(db) {
  const collection = db.collection(COLLECTION_NAME)
  
  for (const indexDef of INDEXES) {
    try {
      await collection.createIndex(indexDef.key, {
        name: indexDef.name,
        unique: indexDef.unique || false,
        background: indexDef.background || true,
        expireAfterSeconds: indexDef.expireAfterSeconds
      })
    } catch (error) {
      console.warn(`[${COLLECTION_NAME}] Index ${indexDef.name} creation warning:`, error.message)
    }
  }
  
  console.log(`[${COLLECTION_NAME}] Ensured ${INDEXES.length} indexes`)
}

/**
 * Save a new approval request
 * @param {import('mongodb').Db} db
 * @param {OpsApprovalRequest} request
 */
export async function saveApprovalRequest(db, request) {
  const collection = db.collection(COLLECTION_NAME)
  return collection.insertOne(request)
}

/**
 * Get approval request by requestId
 * @param {import('mongodb').Db} db
 * @param {string} requestId
 */
export async function getApprovalRequest(db, requestId) {
  const collection = db.collection(COLLECTION_NAME)
  return collection.findOne({ requestId })
}

/**
 * Update approval request status
 * @param {import('mongodb').Db} db
 * @param {string} requestId
 * @param {object} updates
 */
export async function updateApprovalRequest(db, requestId, updates) {
  const collection = db.collection(COLLECTION_NAME)
  return collection.updateOne(
    { requestId },
    { $set: updates }
  )
}

/**
 * List approval requests with filters
 * @param {import('mongodb').Db} db
 * @param {object} filters
 * @param {object} options
 */
export async function listApprovalRequests(db, filters = {}, options = {}) {
  const collection = db.collection(COLLECTION_NAME)
  
  const query = {}
  if (filters.status) query.status = filters.status
  if (filters.tool) query.tool = filters.tool
  if (filters.requestedBy) query.requestedBy = filters.requestedBy
  
  return collection
    .find(query)
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(Math.min(options.limit || 50, 100))
    .toArray()
}

/**
 * Count approval requests by status
 * @param {import('mongodb').Db} db
 */
export async function countByStatus(db) {
  const collection = db.collection(COLLECTION_NAME)
  
  const pipeline = [
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]
  
  const results = await collection.aggregate(pipeline).toArray()
  
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    executed: 0,
    expired: 0
  }
  
  for (const r of results) {
    if (counts[r._id] !== undefined) {
      counts[r._id] = r.count
    }
  }
  
  return counts
}

// =============================================================================
// Default Export
// =============================================================================

const opsApprovalRequest = {
  COLLECTION_NAME,
  STATUS_VALUES,
  DEFAULT_EXPIRY_HOURS,
  INDEXES,
  generateRequestId,
  hashPayload,
  verifyPayloadHash,
  createApprovalRequest,
  validateStatusTransition,
  ensureIndexes,
  saveApprovalRequest,
  getApprovalRequest,
  updateApprovalRequest,
  listApprovalRequests,
  countByStatus
}

export default opsApprovalRequest
