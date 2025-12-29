/**
 * Ops Audit Logging
 * 
 * Provides audit logging for all ops operations with redaction of sensitive data.
 */

// Keys that should be redacted in audit logs
const SENSITIVE_KEYS = [
  'apikey', 'api_key', 'apiKey',
  'secret', 'secretkey', 'secret_key', 'secretKey',
  'token', 'accesstoken', 'access_token', 'accessToken',
  'password', 'passwd', 'pwd',
  'authorization', 'auth',
  'credential', 'credentials',
  'private', 'privatekey', 'private_key', 'privateKey',
  'stripe_secret', 'stripeSecret', 'stripesecret'
]

/**
 * Redact sensitive values from an object
 * @param {any} obj - Object to redact
 * @param {number} depth - Current recursion depth
 * @returns {any} Redacted object
 */
export function redactSensitiveData(obj, depth = 0) {
  if (depth > 10) return '[MAX_DEPTH]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1))
  }
  
  const redacted = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k.toLowerCase()))
    
    if (isSensitive && typeof value === 'string' && value.length > 0) {
      redacted[key] = `[REDACTED:${value.length}chars]`
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1)
    } else {
      redacted[key] = value
    }
  }
  
  return redacted
}

/**
 * Create an audit log entry
 * @param {object} params - Audit parameters
 * @returns {object} Audit log entry
 */
export function createAuditEntry(params) {
  const {
    requestId,
    tool,
    args,
    actor,
    dryRun,
    status,
    result,
    error,
    startedAt,
    completedAt
  } = params
  
  return {
    requestId,
    tool,
    args: redactSensitiveData(args),
    actor: actor || { type: 'system', id: 'unknown' },
    dryRun: !!dryRun,
    status,
    result: result ? {
      ok: result.ok,
      summary: result.summary || null
    } : null,
    error: error ? {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An error occurred'
    } : null,
    startedAt: startedAt || new Date(),
    completedAt: completedAt || new Date(),
    durationMs: completedAt && startedAt ? 
      new Date(completedAt).getTime() - new Date(startedAt).getTime() : null,
    createdAt: new Date()
  }
}

/**
 * Save audit log to database
 * @param {Db} db - MongoDB database
 * @param {object} entry - Audit entry
 * @returns {Promise<void>}
 */
export async function saveAuditLog(db, entry) {
  const collection = db.collection('ops_audit_logs')
  
  // Ensure indexes exist
  try {
    await collection.createIndex({ requestId: 1 }, { unique: true })
    await collection.createIndex({ tool: 1, createdAt: -1 })
    await collection.createIndex({ 'actor.id': 1, createdAt: -1 })
    await collection.createIndex({ status: 1, createdAt: -1 })
  } catch (e) {
    // Indexes may already exist
  }
  
  await collection.insertOne(entry)
}

/**
 * Get audit log by requestId
 * @param {Db} db - MongoDB database
 * @param {string} requestId - Request ID
 * @returns {Promise<object|null>}
 */
export async function getAuditLog(db, requestId) {
  const collection = db.collection('ops_audit_logs')
  return collection.findOne({ requestId })
}
