/**
 * Ops Event Log Schema
 * 
 * Captures every ops execution for audit, debugging, and analytics.
 * Collection: ops_event_logs
 * 
 * @module lib/schemas/opsEventLog
 */

// =============================================================================
// TypeScript Types (JSDoc for IDE Support)
// =============================================================================

/**
 * @typedef {'success' | 'failed' | 'partial'} OpsEventStatus
 */

/**
 * @typedef {'n8n' | 'human' | 'system' | 'api'} OpsEventActor
 */

/**
 * @typedef {Object} OpsEventChecklist
 * @property {number} step - Step number (1-4)
 * @property {string} item - Human-readable item name
 * @property {string} tool - Tool name that was executed
 * @property {'done' | 'warning' | 'in_progress' | 'skipped' | 'failed'} status - Step status
 * @property {string} details - Human-readable details
 * @property {number} durationMs - Step execution time
 */

/**
 * @typedef {Object} OpsEventError
 * @property {string} code - Error code (e.g., 'BOOTSTRAP_ERROR')
 * @property {string} message - Human-readable error message
 * @property {number} [step] - Step number where error occurred
 * @property {Object} [details] - Additional error details
 */

/**
 * @typedef {Object} OpsEventMetadata
 * @property {boolean} [dryRun] - Whether this was a dry run
 * @property {boolean} [ready] - For bootstrap: tenant readiness status
 * @property {string} [readyMessage] - Human-readable readiness message
 * @property {OpsEventChecklist[]} [checklist] - Step-by-step execution results
 * @property {Object} [recommendations] - Suggested improvements
 * @property {Object} [stats] - Aggregate statistics
 * @property {OpsEventError} [error] - Error details if failed
 * @property {string} [keyId] - Hashed API key identifier (for security auditing)
 * @property {string} [argsFormat] - Request format used (new, legacy-args, legacy-input, legacy-flat)
 * @property {Object} [toolResult] - Raw tool execution result
 */

/**
 * @typedef {Object} OpsEventLog
 * @property {string} requestId - Unique request identifier (required, indexed)
 * @property {string} tool - Tool name (e.g., "tenant.bootstrap")
 * @property {string} [businessId] - Business/tenant identifier (indexed for lookups)
 * @property {OpsEventStatus} status - Execution status
 * @property {number} durationMs - Total execution time in milliseconds
 * @property {Date} executedAt - When the operation was executed
 * @property {OpsEventActor} actor - Who/what triggered the execution
 * @property {OpsEventMetadata} metadata - Flexible tool-specific data
 * @property {Date} createdAt - Document creation timestamp
 * @property {Date} [updatedAt] - Document update timestamp
 */

/**
 * @typedef {Object} OpsEventLogInput
 * @property {string} requestId
 * @property {string} tool
 * @property {string} [businessId]
 * @property {OpsEventStatus} status
 * @property {number} durationMs
 * @property {Date} executedAt
 * @property {OpsEventActor} actor
 * @property {OpsEventMetadata} [metadata]
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Collection name for ops event logs
 */
export const COLLECTION_NAME = 'ops_event_logs'

/**
 * Valid status values
 */
export const STATUS_VALUES = ['success', 'failed', 'partial']

/**
 * Valid actor values
 */
export const ACTOR_VALUES = ['n8n', 'human', 'system', 'api']

/**
 * Index definitions for the collection
 * These should be created once during app initialization
 */
export const INDEXES = [
  // Unique lookup by requestId
  {
    key: { requestId: 1 },
    name: 'idx_requestId',
    unique: true,
    background: true
  },
  // Tenant history queries (most common query pattern)
  {
    key: { businessId: 1, executedAt: -1 },
    name: 'idx_businessId_executedAt',
    background: true,
    sparse: true // businessId is optional
  },
  // Monitoring: tool + status for dashboards
  {
    key: { tool: 1, status: 1 },
    name: 'idx_tool_status',
    background: true
  },
  // Time-based queries (recent events, cleanup)
  {
    key: { executedAt: -1 },
    name: 'idx_executedAt',
    background: true
  },
  // Actor-based queries (who triggered what)
  {
    key: { actor: 1, executedAt: -1 },
    name: 'idx_actor_executedAt',
    background: true
  },
  // TTL index: auto-delete logs older than 90 days
  {
    key: { createdAt: 1 },
    name: 'idx_ttl_90days',
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    background: true
  }
]

// =============================================================================
// Schema Validation (for MongoDB JSON Schema validation)
// =============================================================================

/**
 * MongoDB JSON Schema validator for the collection
 * Use with db.createCollection() or db.command({ collMod: ... })
 */
export const JSON_SCHEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['requestId', 'tool', 'status', 'durationMs', 'executedAt', 'actor'],
    properties: {
      requestId: {
        bsonType: 'string',
        description: 'Unique request identifier - required'
      },
      tool: {
        bsonType: 'string',
        description: 'Tool name (e.g., tenant.bootstrap) - required'
      },
      businessId: {
        bsonType: 'string',
        description: 'Business/tenant identifier - optional'
      },
      status: {
        enum: STATUS_VALUES,
        description: 'Execution status - required'
      },
      durationMs: {
        bsonType: 'number',
        minimum: 0,
        description: 'Execution time in milliseconds - required'
      },
      executedAt: {
        bsonType: 'date',
        description: 'When the operation was executed - required'
      },
      actor: {
        enum: ACTOR_VALUES,
        description: 'Who/what triggered the execution - required'
      },
      metadata: {
        bsonType: 'object',
        description: 'Flexible tool-specific data'
      },
      createdAt: {
        bsonType: 'date',
        description: 'Document creation timestamp'
      },
      updatedAt: {
        bsonType: 'date',
        description: 'Document update timestamp'
      }
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a new ops event log entry
 * 
 * @param {OpsEventLogInput} input - Event log input
 * @returns {OpsEventLog} Complete event log document
 * 
 * @example
 * const event = createOpsEventLog({
 *   requestId: 'bootstrap-123',
 *   tool: 'tenant.bootstrap',
 *   businessId: 'biz_abc123',
 *   status: 'success',
 *   durationMs: 405,
 *   executedAt: new Date(),
 *   actor: 'n8n',
 *   metadata: {
 *     dryRun: false,
 *     ready: true,
 *     checklist: [...]
 *   }
 * })
 */
export function createOpsEventLog(input) {
  const now = new Date()
  
  return {
    requestId: input.requestId,
    tool: input.tool,
    businessId: input.businessId || null,
    status: input.status,
    durationMs: input.durationMs,
    executedAt: input.executedAt || now,
    actor: input.actor,
    metadata: input.metadata || {},
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Create an ops event log from a tenant.bootstrap result
 * 
 * @param {string} requestId - Request identifier
 * @param {Object} result - tenant.bootstrap execution result
 * @param {Object} options - Additional options
 * @param {OpsEventActor} [options.actor='system'] - Who triggered it
 * @param {string} [options.keyId] - API key identifier
 * @param {string} [options.argsFormat] - Request format used
 * @returns {OpsEventLog} Event log document
 */
export function createFromBootstrapResult(requestId, result, options = {}) {
  // Determine status from result
  let status = 'success'
  if (result.ok === false) {
    status = 'failed'
  } else if (result.ready === false) {
    status = 'partial'
  }
  
  return createOpsEventLog({
    requestId,
    tool: 'tenant.bootstrap',
    businessId: result.businessId,
    status,
    durationMs: result.durationMs || 0,
    executedAt: new Date(),
    actor: options.actor || 'system',
    metadata: {
      dryRun: result.dryRun || false,
      ready: result.ready,
      readyMessage: result.readyMessage,
      checklist: result.checklist,
      recommendations: result.recommendations,
      stats: result.stats,
      error: result.error,
      keyId: options.keyId,
      argsFormat: options.argsFormat
    }
  })
}

/**
 * Create an ops event log for a failed execution
 * 
 * @param {string} requestId - Request identifier
 * @param {string} tool - Tool name
 * @param {OpsEventError} error - Error details
 * @param {Object} options - Additional options
 * @returns {OpsEventLog} Event log document
 */
export function createFailedEvent(requestId, tool, error, options = {}) {
  return createOpsEventLog({
    requestId,
    tool,
    businessId: options.businessId,
    status: 'failed',
    durationMs: options.durationMs || 0,
    executedAt: new Date(),
    actor: options.actor || 'system',
    metadata: {
      error,
      keyId: options.keyId,
      argsFormat: options.argsFormat
    }
  })
}

/**
 * Validate an ops event log input
 * 
 * @param {OpsEventLogInput} input - Input to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateOpsEventLog(input) {
  const errors = []
  
  if (!input.requestId || typeof input.requestId !== 'string') {
    errors.push('requestId is required and must be a string')
  }
  
  if (!input.tool || typeof input.tool !== 'string') {
    errors.push('tool is required and must be a string')
  }
  
  if (!input.status || !STATUS_VALUES.includes(input.status)) {
    errors.push(`status must be one of: ${STATUS_VALUES.join(', ')}`)
  }
  
  if (typeof input.durationMs !== 'number' || input.durationMs < 0) {
    errors.push('durationMs must be a non-negative number')
  }
  
  if (!input.executedAt || !(input.executedAt instanceof Date)) {
    errors.push('executedAt is required and must be a Date')
  }
  
  if (!input.actor || !ACTOR_VALUES.includes(input.actor)) {
    errors.push(`actor must be one of: ${ACTOR_VALUES.join(', ')}`)
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Ensure indexes exist on the collection
 * Call this during app initialization
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @returns {Promise<void>}
 */
export async function ensureIndexes(db) {
  const collection = db.collection(COLLECTION_NAME)
  
  for (const indexDef of INDEXES) {
    try {
      await collection.createIndex(indexDef.key, {
        name: indexDef.name,
        unique: indexDef.unique || false,
        background: indexDef.background || true,
        sparse: indexDef.sparse || false,
        expireAfterSeconds: indexDef.expireAfterSeconds
      })
    } catch (error) {
      // Index might already exist with different options
      console.warn(`[ops_event_logs] Index ${indexDef.name} creation warning:`, error.message)
    }
  }
  
  console.log(`[ops_event_logs] Ensured ${INDEXES.length} indexes on ${COLLECTION_NAME}`)
}

/**
 * Save an ops event log to the database
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {OpsEventLog} event - Event to save
 * @returns {Promise<import('mongodb').InsertOneResult>}
 */
export async function saveOpsEventLog(db, event) {
  const validation = validateOpsEventLog(event)
  if (!validation.valid) {
    throw new Error(`Invalid ops event log: ${validation.errors.join(', ')}`)
  }
  
  const collection = db.collection(COLLECTION_NAME)
  return collection.insertOne(event)
}

/**
 * Query ops event logs for a business
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {string} businessId - Business identifier
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Max results
 * @param {number} [options.skip=0] - Skip results (pagination)
 * @param {string} [options.tool] - Filter by tool
 * @param {OpsEventStatus} [options.status] - Filter by status
 * @returns {Promise<OpsEventLog[]>}
 */
export async function getEventsByBusiness(db, businessId, options = {}) {
  const collection = db.collection(COLLECTION_NAME)
  
  const query = { businessId }
  if (options.tool) query.tool = options.tool
  if (options.status) query.status = options.status
  
  return collection
    .find(query)
    .sort({ executedAt: -1 })
    .skip(options.skip || 0)
    .limit(Math.min(options.limit || 50, 100))
    .toArray()
}

/**
 * Get event by requestId
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {string} requestId - Request identifier
 * @returns {Promise<OpsEventLog | null>}
 */
export async function getEventByRequestId(db, requestId) {
  const collection = db.collection(COLLECTION_NAME)
  return collection.findOne({ requestId })
}

/**
 * Get aggregate stats for monitoring
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {Object} [options] - Query options
 * @param {Date} [options.since] - Start date (default: 24 hours ago)
 * @returns {Promise<Object>} Aggregate statistics
 */
export async function getEventStats(db, options = {}) {
  const collection = db.collection(COLLECTION_NAME)
  const since = options.since || new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  const pipeline = [
    { $match: { executedAt: { $gte: since } } },
    {
      $group: {
        _id: { tool: '$tool', status: '$status' },
        count: { $sum: 1 },
        avgDurationMs: { $avg: '$durationMs' },
        maxDurationMs: { $max: '$durationMs' }
      }
    },
    {
      $group: {
        _id: '$_id.tool',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgDurationMs: '$avgDurationMs',
            maxDurationMs: '$maxDurationMs'
          }
        },
        totalCount: { $sum: '$count' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]
  
  const results = await collection.aggregate(pipeline).toArray()
  
  // Calculate overall totals
  let totalSuccess = 0
  let totalFailed = 0
  let totalPartial = 0
  
  for (const tool of results) {
    for (const s of tool.statuses) {
      if (s.status === 'success') totalSuccess += s.count
      else if (s.status === 'failed') totalFailed += s.count
      else if (s.status === 'partial') totalPartial += s.count
    }
  }
  
  return {
    since: since.toISOString(),
    tools: results,
    totals: {
      success: totalSuccess,
      failed: totalFailed,
      partial: totalPartial,
      total: totalSuccess + totalFailed + totalPartial
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  COLLECTION_NAME,
  STATUS_VALUES,
  ACTOR_VALUES,
  INDEXES,
  JSON_SCHEMA,
  createOpsEventLog,
  createFromBootstrapResult,
  createFailedEvent,
  validateOpsEventLog,
  ensureIndexes,
  saveOpsEventLog,
  getEventsByBusiness,
  getEventByRequestId,
  getEventStats
}
