/**
 * MongoDB-Backed Rate Limiter with Caller Identity
 * 
 * Serverless-safe rate limiter that persists across cold starts.
 * Uses atomic MongoDB operations for accurate counting.
 * 
 * Key Format: {caller}|{ipHash}|{endpoint}|{windowId}
 * 
 * Caller Types:
 * - n8n: Automation workflows (200/min)
 * - ops_console: Human users via Ops Console UI (300/min)
 * - unknown: Unidentified callers (100/min)
 * 
 * Collection: ops_rate_limits
 * TTL: Auto-cleanup via MongoDB TTL index (60s after window expires)
 * 
 * @module lib/ops/rateLimiter
 */

import { MongoClient, Db, IndexSpecification } from 'mongodb'
import crypto from 'crypto'
// @ts-ignore - env.js is a JavaScript module
import { env } from '@/lib/env.js'

// ============================================================================
// Configuration
// ============================================================================

const COLLECTION_NAME = 'ops_rate_limits'

// Rate limits by caller type (requests per minute)
const CALLER_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  // n8n automation gets generous limits
  n8n: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 200,  // 200 requests per minute
  },
  // Ops console (human users) get highest limits
  ops_console: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 300,  // 300 requests per minute
  },
  // Unknown/unidentified callers get lowest limits
  unknown: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 100,  // 100 requests per minute
  }
}

// Index definitions
const INDEXES = [
  // Unique key for rate limit entry
  { key: { key: 1 }, unique: true },
  // TTL index for auto-cleanup (documents expire 60s after window ends)
  { key: { expiresAt: 1 }, expireAfterSeconds: 0 }
]

// ============================================================================
// Types
// ============================================================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
  limit: number
  retryAfter?: number
  caller?: string
  endpoint?: string
}

interface RateLimitDoc {
  key: string
  count: number
  windowStart: Date
  expiresAt: Date
  caller?: string
  endpoint?: string
}

// ============================================================================
// Database Connection
// ============================================================================

let client: MongoClient | null = null
let db: Db | null = null

async function getDatabase(): Promise<Db> {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db!
}

// ============================================================================
// Index Management
// ============================================================================

let indexesEnsured = false

async function ensureIndexes(database: Db): Promise<void> {
  if (indexesEnsured) return
  
  try {
    const collection = database.collection(COLLECTION_NAME)
    
    for (const indexDef of INDEXES) {
      try {
        await collection.createIndex(indexDef.key, {
          unique: indexDef.unique || false,
          expireAfterSeconds: indexDef.expireAfterSeconds
        })
      } catch (error: any) {
        // Ignore duplicate index errors
        if (error.code !== 85 && error.code !== 86) {
          console.warn(`[rateLimiter] Failed to create index: ${error.message}`)
        }
      }
    }
    
    indexesEnsured = true
  } catch (error: any) {
    console.warn(`[rateLimiter] Index creation failed: ${error.message}`)
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract caller identity from request header
 * Supported values: n8n, ops_console
 */
export function getCallerIdentity(request: Request): string {
  const callerHeader = request.headers.get('x-book8-caller')
  
  if (callerHeader === 'n8n') return 'n8n'
  if (callerHeader === 'ops_console') return 'ops_console'
  return 'unknown'
}

/**
 * Get IP hash from request
 */
export function getIpHash(request: Request): string {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown-ip'
  
  return crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 8)
}

/**
 * Get rate limit config for a caller type
 */
export function getRateLimitConfig(caller: string): { windowMs: number; maxRequests: number } {
  return CALLER_LIMITS[caller] || CALLER_LIMITS.unknown
}

/**
 * Compute the rate limit key
 * Format: {caller}|{ipHash}|{endpoint}|{windowId}
 */
function computeRateLimitKey(
  caller: string, 
  ipHash: string, 
  endpoint: string, 
  windowStart: Date
): string {
  const windowId = Math.floor(windowStart.getTime() / 60000) // minute-based window
  return `${caller}|${ipHash}|${endpoint}|${windowId}`
}

// ============================================================================
// Main Rate Limiting Function
// ============================================================================

/**
 * Check if request is within rate limit
 * 
 * @param request - The incoming request object
 * @param endpoint - Endpoint identifier (e.g., 'execute', 'tools', 'logs')
 * @returns Rate limit result with allowed status and headers
 */
export async function checkRateLimitWithRequest(
  request: Request,
  endpoint: string
): Promise<RateLimitResult> {
  const caller = getCallerIdentity(request)
  const ipHash = getIpHash(request)
  const config = getRateLimitConfig(caller)
  const now = new Date()
  
  // Calculate window boundaries
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const windowEnd = new Date(windowStart.getTime() + config.windowMs)
  const expiresAt = new Date(windowEnd.getTime() + 60000) // 60s buffer for TTL
  
  // Compute rate limit key
  const key = computeRateLimitKey(caller, ipHash, endpoint, windowStart)
  
  console.log(`[RATE_LIMITER] /${endpoint} - caller=${caller}, ip=${ipHash}, key=${key}`)
  
  try {
    const database = await getDatabase()
    await ensureIndexes(database)
    
    const collection = database.collection<RateLimitDoc>(COLLECTION_NAME)
    
    // Atomic increment with upsert
    const result = await collection.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          windowStart,
          expiresAt,
          caller,
          endpoint
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    )
    
    const doc = result
    const count = doc?.count || 1
    
    // Calculate time until window reset
    const resetIn = Math.max(0, windowEnd.getTime() - now.getTime())
    const retryAfterSeconds = Math.ceil(resetIn / 1000)
    
    const allowed = count <= config.maxRequests
    const remaining = Math.max(0, config.maxRequests - count)
    
    console.log(`[RATE_LIMITER] /${endpoint} - allowed=${allowed}, count=${count}/${config.maxRequests}, remaining=${remaining}`)
    
    if (!allowed) {
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: config.maxRequests,
        retryAfter: retryAfterSeconds,
        caller,
        endpoint
      }
    }
    
    return {
      allowed: true,
      remaining,
      resetIn,
      limit: config.maxRequests,
      caller,
      endpoint
    }
    
  } catch (error: any) {
    // If MongoDB fails, log warning but allow the request
    console.error(`[RATE_LIMITER] MongoDB error: ${error.message}`)
    
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
      limit: config.maxRequests,
      caller,
      endpoint
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use checkRateLimitWithRequest instead
 */
export async function checkRateLimit(
  identifier: string,
  keyType: string = 'default',
  tool: string | null = null
): Promise<RateLimitResult> {
  // Map old keyType to new caller type
  let caller = 'unknown'
  if (keyType.includes('admin')) caller = 'ops_console'
  if (keyType.includes('n8n')) caller = 'n8n'
  
  const config = getRateLimitConfig(caller)
  const now = new Date()
  
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const windowEnd = new Date(windowStart.getTime() + config.windowMs)
  const expiresAt = new Date(windowEnd.getTime() + 60000)
  
  const endpoint = tool || 'all'
  const key = computeRateLimitKey(caller, identifier, endpoint, windowStart)
  
  console.log(`[RATE_LIMITER] Legacy call - caller=${caller}, id=${identifier}, endpoint=${endpoint}`)
  
  try {
    const database = await getDatabase()
    await ensureIndexes(database)
    
    const collection = database.collection<RateLimitDoc>(COLLECTION_NAME)
    
    const result = await collection.findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { windowStart, expiresAt, caller, endpoint }
      },
      { upsert: true, returnDocument: 'after' }
    )
    
    const count = result?.count || 1
    const resetIn = Math.max(0, windowEnd.getTime() - now.getTime())
    
    const allowed = count <= config.maxRequests
    
    console.log(`[RATE_LIMITER] Legacy - allowed=${allowed}, count=${count}/${config.maxRequests}`)
    
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - count),
      resetIn,
      limit: config.maxRequests,
      retryAfter: allowed ? undefined : Math.ceil(resetIn / 1000),
      caller,
      endpoint
    }
    
  } catch (error: any) {
    console.error(`[RATE_LIMITER] MongoDB error: ${error.message}`)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
      limit: config.maxRequests
    }
  }
}

/**
 * Get rate limit status without incrementing
 */
export async function getRateLimitStatus(
  request: Request,
  endpoint: string
): Promise<RateLimitResult> {
  const caller = getCallerIdentity(request)
  const ipHash = getIpHash(request)
  const config = getRateLimitConfig(caller)
  const now = new Date()
  
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const windowEnd = new Date(windowStart.getTime() + config.windowMs)
  const key = computeRateLimitKey(caller, ipHash, endpoint, windowStart)
  
  try {
    const database = await getDatabase()
    const collection = database.collection<RateLimitDoc>(COLLECTION_NAME)
    
    const doc = await collection.findOne({ key })
    const count = doc?.count || 0
    const resetIn = Math.max(0, windowEnd.getTime() - now.getTime())
    
    return {
      allowed: count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetIn,
      limit: config.maxRequests,
      caller,
      endpoint
    }
    
  } catch (error: any) {
    console.error(`[RATE_LIMITER] Status check failed: ${error.message}`)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
      limit: config.maxRequests
    }
  }
}

/**
 * Get rate limit statistics
 */
export async function getRateLimitStats(): Promise<{
  totalEntries: number
  byCaller: Record<string, number>
  byEndpoint: Record<string, number>
}> {
  try {
    const database = await getDatabase()
    const collection = database.collection<RateLimitDoc>(COLLECTION_NAME)
    
    const totalEntries = await collection.countDocuments()
    
    // Aggregate by caller
    const callerAgg = await collection.aggregate([
      { $group: { _id: '$caller', count: { $sum: 1 } } }
    ]).toArray()
    
    const byCaller: Record<string, number> = {}
    for (const item of callerAgg) {
      byCaller[item._id || 'unknown'] = item.count
    }
    
    // Aggregate by endpoint
    const endpointAgg = await collection.aggregate([
      { $group: { _id: '$endpoint', count: { $sum: 1 } } }
    ]).toArray()
    
    const byEndpoint: Record<string, number> = {}
    for (const item of endpointAgg) {
      byEndpoint[item._id || 'unknown'] = item.count
    }
    
    return { totalEntries, byCaller, byEndpoint }
    
  } catch (error: any) {
    console.error(`[RATE_LIMITER] Stats failed: ${error.message}`)
    return { totalEntries: 0, byCaller: {}, byEndpoint: {} }
  }
}

// ============================================================================
// Export
// ============================================================================

const rateLimiter = {
  checkRateLimitWithRequest,
  checkRateLimit,
  getRateLimitStatus,
  getRateLimitStats,
  getCallerIdentity,
  getIpHash,
  getRateLimitConfig,
  CALLER_LIMITS,
  COLLECTION_NAME
}

export default rateLimiter
