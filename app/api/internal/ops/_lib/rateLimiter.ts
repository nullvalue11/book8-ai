/**
 * MongoDB-Backed Rate Limiter
 * 
 * Serverless-safe rate limiter that persists across cold starts.
 * Uses atomic MongoDB operations for accurate counting.
 * 
 * Collection: ops_rate_limits
 * TTL: Auto-cleanup via MongoDB TTL index (60s after window expires)
 * 
 * @module lib/ops/rateLimiter
 */

import { MongoClient, Db } from 'mongodb'
// @ts-ignore - env.js is a JavaScript module
import { env } from '@/lib/env.js'

// ============================================================================
// Configuration
// ============================================================================

const COLLECTION_NAME = 'ops_rate_limits'

// Different rate limits for different key types
const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  // Admin keys get higher limits
  admin: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 300,  // 300 requests per minute
  },
  // n8n automation keys get generous limits
  n8n: {
    windowMs: 60000,   // 1 minute window
    maxRequests: 200,  // 200 requests per minute
  },
  // Default/legacy keys
  default: {
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
}

interface RateLimitDoc {
  key: string
  count: number
  windowStart: Date
  expiresAt: Date
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

/**
 * Ensure indexes exist on the rate limits collection
 * Called once per process (cached)
 */
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
    console.log('[rateLimiter] Indexes ensured on', COLLECTION_NAME)
  } catch (error: any) {
    console.warn(`[rateLimiter] Index creation failed: ${error.message}`)
  }
}

// ============================================================================
// Rate Limiting Functions
// ============================================================================

/**
 * Get rate limit config based on key type
 */
export function getRateLimitConfig(keyId: string): { windowMs: number; maxRequests: number } {
  if (keyId?.includes('admin')) return RATE_LIMITS.admin
  if (keyId?.includes('n8n')) return RATE_LIMITS.n8n
  return RATE_LIMITS.default
}

/**
 * Compute the rate limit key
 * Format: {caller}|{tool}|{windowStart}
 */
function computeRateLimitKey(caller: string, tool: string | null, windowStart: Date): string {
  const windowId = Math.floor(windowStart.getTime() / 60000) // minute-based window
  const toolPart = tool || 'all'
  return `${caller}|${toolPart}|${windowId}`
}

/**
 * Check if request is within rate limit (MongoDB-backed)
 * 
 * Uses atomic findOneAndUpdate for accurate counting across serverless instances.
 * 
 * @param identifier - API key identifier (e.g., "key_abc12345")
 * @param keyType - Type of key for determining limits
 * @param tool - Optional tool name for per-tool rate limiting
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  keyType: string = 'default',
  tool: string | null = null
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(keyType)
  const now = new Date()
  
  // Calculate window boundaries
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const windowEnd = new Date(windowStart.getTime() + config.windowMs)
  
  // Add 60s buffer for TTL cleanup
  const expiresAt = new Date(windowEnd.getTime() + 60000)
  
  // Compute rate limit key
  const key = computeRateLimitKey(identifier, tool, windowStart)
  
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
          expiresAt
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
    
    if (count > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: config.maxRequests,
        retryAfter: retryAfterSeconds
      }
    }
    
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - count),
      resetIn,
      limit: config.maxRequests
    }
    
  } catch (error: any) {
    // If MongoDB fails, log warning but allow the request
    // This prevents rate limiter failures from blocking all traffic
    console.error(`[rateLimiter] MongoDB error: ${error.message}`)
    
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
      limit: config.maxRequests
    }
  }
}

/**
 * Check rate limit synchronously using in-memory fallback
 * Used when async MongoDB call isn't possible
 * 
 * @deprecated Use checkRateLimit (async) instead
 */
const memoryFallback = new Map<string, { count: number; windowStart: number }>()

export function checkRateLimitSync(
  identifier: string,
  keyType: string = 'default',
  tool: string | null = null
): RateLimitResult {
  const config = getRateLimitConfig(keyType)
  const now = Date.now()
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs
  const key = computeRateLimitKey(identifier, tool, new Date(windowStart))
  
  const existing = memoryFallback.get(key)
  
  if (existing && existing.windowStart === windowStart) {
    existing.count++
    
    if (existing.count > config.maxRequests) {
      const resetIn = windowStart + config.windowMs - now
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: config.maxRequests,
        retryAfter: Math.ceil(resetIn / 1000)
      }
    }
    
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - existing.count),
      resetIn: windowStart + config.windowMs - now,
      limit: config.maxRequests
    }
  }
  
  // New window
  memoryFallback.set(key, { count: 1, windowStart })
  
  // Cleanup old windows (1% chance)
  if (Math.random() < 0.01) {
    const entries = Array.from(memoryFallback.entries())
    for (const entry of entries) {
      const [k, v] = entry
      if (v.windowStart < windowStart) {
        memoryFallback.delete(k)
      }
    }
  }
  
  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetIn: config.windowMs,
    limit: config.maxRequests
  }
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  identifier: string,
  keyType: string = 'default',
  tool: string | null = null
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(keyType)
  const now = new Date()
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const windowEnd = new Date(windowStart.getTime() + config.windowMs)
  const key = computeRateLimitKey(identifier, tool, windowStart)
  
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
      limit: config.maxRequests
    }
    
  } catch (error: any) {
    console.error(`[rateLimiter] Status check failed: ${error.message}`)
    
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
      limit: config.maxRequests
    }
  }
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or manual override
 */
export async function resetRateLimit(
  identifier: string,
  tool: string | null = null
): Promise<boolean> {
  const config = getRateLimitConfig(identifier)
  const now = new Date()
  const windowStart = new Date(Math.floor(now.getTime() / config.windowMs) * config.windowMs)
  const key = computeRateLimitKey(identifier, tool, windowStart)
  
  try {
    const database = await getDatabase()
    const collection = database.collection(COLLECTION_NAME)
    
    const result = await collection.deleteOne({ key })
    return result.deletedCount > 0
    
  } catch (error: any) {
    console.error(`[rateLimiter] Reset failed: ${error.message}`)
    return false
  }
}

/**
 * Get rate limit statistics (for monitoring)
 */
export async function getRateLimitStats(): Promise<{
  totalEntries: number
  activeKeys: string[]
  oldestEntry: Date | null
}> {
  try {
    const database = await getDatabase()
    const collection = database.collection<RateLimitDoc>(COLLECTION_NAME)
    
    const totalEntries = await collection.countDocuments()
    
    const activeEntries = await collection
      .find({})
      .sort({ windowStart: -1 })
      .limit(100)
      .toArray()
    
    const activeKeys = activeEntries.map(e => e.key)
    const oldestEntry = activeEntries.length > 0 
      ? activeEntries[activeEntries.length - 1].windowStart 
      : null
    
    return {
      totalEntries,
      activeKeys,
      oldestEntry
    }
    
  } catch (error: any) {
    console.error(`[rateLimiter] Stats failed: ${error.message}`)
    return {
      totalEntries: 0,
      activeKeys: [],
      oldestEntry: null
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  checkRateLimit,
  checkRateLimitSync,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats,
  getRateLimitConfig,
  RATE_LIMITS,
  COLLECTION_NAME
}
