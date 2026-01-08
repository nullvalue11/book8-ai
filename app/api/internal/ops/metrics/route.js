/**
 * GET /api/internal/ops/metrics
 * 
 * Ops Control Plane Monitoring & Metrics Endpoint
 * 
 * Provides observability metrics for the ops control plane:
 * - Execution counts (total, successful, failed, pending, approval_required)
 * - Per-tool metrics (count, failures, average duration)
 * - Rate limiting statistics
 * - Health status
 * 
 * Query Parameters:
 * - since (optional): ISO date string, start of time range (default: 24 hours ago)
 * - until (optional): ISO date string, end of time range (default: now)
 * - refresh (optional): If 'true', bypass cache and get fresh data
 * 
 * Authentication:
 * Requires x-book8-internal-secret header with valid API key.
 * Required scope: ops.metrics.read or ops.* or *
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/opsEventLog'
import { checkRateLimitWithRequest } from '@/api/internal/ops/_lib/rateLimiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[ops/metrics]'
const VERSION = 'v1.0.0'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const DEFAULT_TIME_RANGE_MS = 24 * 60 * 60 * 1000 // 24 hours

// In-memory cache for metrics
let metricsCache = {
  data: null,
  generatedAt: null,
  cacheKey: null
}

// Track app start time for uptime
const APP_START_TIME = Date.now()

// ============================================================================
// Scoped API Keys Configuration
// ============================================================================

function getApiKeyScopes() {
  const keys = {}
  
  if (env.OPS_KEY_N8N) {
    keys[env.OPS_KEY_N8N] = ['ops.execute', 'ops.logs.read', 'ops.tools.read', 'ops.metrics.read', 'tenant.*', 'voice.*', 'billing.read']
  }
  
  if (env.OPS_KEY_ADMIN) {
    keys[env.OPS_KEY_ADMIN] = ['*']
  }
  
  if (env.OPS_INTERNAL_SECRET) {
    keys[env.OPS_INTERNAL_SECRET] = ['*']
  }
  
  if (env.ADMIN_TOKEN && Object.keys(keys).length === 0) {
    keys[env.ADMIN_TOKEN] = ['*']
  }
  
  return keys
}

function scopeMatches(allowedScope, requiredScope) {
  if (allowedScope === '*') return true
  if (allowedScope === requiredScope) return true
  
  if (allowedScope.endsWith('.*')) {
    const prefix = allowedScope.slice(0, -2)
    return requiredScope.startsWith(prefix + '.')
  }
  
  return false
}

function hasScope(allowedScopes, requiredScope) {
  return allowedScopes.some(scope => scopeMatches(scope, requiredScope))
}

// ============================================================================
// Security: Constant-Time Secret Comparison
// ============================================================================

function verifySecret(provided, expected) {
  if (!provided || !expected) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  const providedBuffer = Buffer.from(provided, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  
  if (providedBuffer.length !== expectedBuffer.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

function getRateLimitIdentifier(apiKey) {
  if (!apiKey) return 'unknown'
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  return `key_${hash.substring(0, 8)}`
}

// ============================================================================
// Database Connection
// ============================================================================

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

// ============================================================================
// Logging
// ============================================================================

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString()
  const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : ''
  const logFn = level === 'error' ? console.error : console.log
  logFn(`${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}] ${message}${dataStr}`)
}

// ============================================================================
// Authentication
// ============================================================================

function verifyAuth(request) {
  const apiKeys = getApiKeyScopes()
  
  if (Object.keys(apiKeys).length === 0) {
    return { 
      valid: false, 
      error: 'No API keys configured',
      help: 'Set OPS_KEY_N8N, OPS_KEY_ADMIN, or OPS_INTERNAL_SECRET in environment'
    }
  }
  
  const providedKey = request.headers.get('x-book8-internal-secret')
  
  if (!providedKey) {
    return { 
      valid: false, 
      error: 'Missing x-book8-internal-secret header',
      help: 'Add header: x-book8-internal-secret: <your-api-key>'
    }
  }
  
  let matchedScopes = null
  let keyId = null
  
  for (const [key, scopes] of Object.entries(apiKeys)) {
    if (verifySecret(providedKey, key)) {
      matchedScopes = scopes
      keyId = getRateLimitIdentifier(key)
      break
    }
  }
  
  if (!matchedScopes) {
    return { 
      valid: false, 
      error: 'Invalid API key',
      help: 'Verify your API key is correct'
    }
  }
  
  // Check for metrics read permission
  const requiredScope = 'ops.metrics.read'
  if (!hasScope(matchedScopes, requiredScope)) {
    return {
      valid: false,
      error: `API key does not have permission to read metrics`,
      help: `Required scope: ${requiredScope}`
    }
  }
  
  return { 
    valid: true, 
    scopes: matchedScopes,
    keyId 
  }
}

// ============================================================================
// Metrics Calculation
// ============================================================================

/**
 * Generate cache key based on time range
 */
function generateCacheKey(since, until) {
  return `${since.toISOString()}-${until.toISOString()}`
}

/**
 * Check if cached metrics are still valid
 */
function isCacheValid(cacheKey) {
  if (!metricsCache.data || !metricsCache.generatedAt || !metricsCache.cacheKey) {
    return false
  }
  
  if (metricsCache.cacheKey !== cacheKey) {
    return false
  }
  
  const age = Date.now() - metricsCache.generatedAt
  return age < CACHE_TTL_MS
}

/**
 * Calculate execution metrics from ops_event_logs
 */
async function calculateMetrics(database, since, until) {
  const collection = database.collection(COLLECTION_NAME)
  
  // Base match for time range
  const matchStage = {
    executedAt: { $gte: since, $lte: until }
  }
  
  // Aggregate pipeline for overall execution metrics
  const executionPipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]
  
  // Aggregate pipeline for per-tool metrics
  const toolPipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$tool',
        count: { $sum: 1 },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalDuration: { $sum: '$durationMs' },
        avgDuration: { $avg: '$durationMs' },
        maxDuration: { $max: '$durationMs' },
        minDuration: { $min: '$durationMs' },
        lastExecution: { $max: '$executedAt' }
      }
    },
    { $sort: { count: -1 } }
  ]
  
  // Aggregate pipeline for per-actor metrics
  const actorPipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$actor',
        count: { $sum: 1 },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    }
  ]
  
  // Pipeline for recent errors (last 10)
  const errorPipeline = [
    { 
      $match: { 
        ...matchStage, 
        status: 'failed' 
      } 
    },
    { $sort: { executedAt: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        requestId: 1,
        tool: 1,
        executedAt: 1,
        error: '$metadata.error'
      }
    }
  ]
  
  // Pipeline for hourly distribution
  const hourlyPipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%dT%H:00:00Z',
            date: '$executedAt'
          }
        },
        count: { $sum: 1 },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    },
    { $sort: { '_id': 1 } },
    { $limit: 48 } // Last 48 hours max
  ]
  
  // Execute all pipelines in parallel
  const [
    executionResults,
    toolResults,
    actorResults,
    recentErrors,
    hourlyResults
  ] = await Promise.all([
    collection.aggregate(executionPipeline).toArray(),
    collection.aggregate(toolPipeline).toArray(),
    collection.aggregate(actorPipeline).toArray(),
    collection.aggregate(errorPipeline).toArray(),
    collection.aggregate(hourlyPipeline).toArray()
  ])
  
  // Process execution results
  const executions = {
    total: 0,
    successful: 0,
    failed: 0,
    partial: 0,
    pending: 0
  }
  
  for (const result of executionResults) {
    executions.total += result.count
    if (result._id === 'success') executions.successful = result.count
    else if (result._id === 'failed') executions.failed = result.count
    else if (result._id === 'partial') executions.partial = result.count
    else if (result._id === 'pending') executions.pending = result.count
  }
  
  // Calculate success rate
  const successRate = executions.total > 0 
    ? ((executions.successful / executions.total) * 100).toFixed(2)
    : '100.00'
  
  // Process tool results
  const byTool = {}
  for (const result of toolResults) {
    if (result._id) {
      byTool[result._id] = {
        count: result.count,
        failed: result.failed,
        successRate: result.count > 0 
          ? (((result.count - result.failed) / result.count) * 100).toFixed(2) + '%'
          : '100.00%',
        avgDurationMs: Math.round(result.avgDuration || 0),
        maxDurationMs: result.maxDuration || 0,
        minDurationMs: result.minDuration || 0,
        lastExecution: result.lastExecution?.toISOString() || null
      }
    }
  }
  
  // Process actor results
  const byActor = {}
  for (const result of actorResults) {
    if (result._id) {
      byActor[result._id] = {
        count: result.count,
        failed: result.failed
      }
    }
  }
  
  // Process hourly distribution
  const hourlyDistribution = hourlyResults.map(r => ({
    hour: r._id,
    count: r.count,
    failed: r.failed
  }))
  
  // Calculate health status
  const healthStatus = calculateHealthStatus(executions, toolResults)
  
  return {
    executions: {
      ...executions,
      successRate: successRate + '%'
    },
    byTool,
    byActor,
    recentErrors,
    hourlyDistribution,
    health: healthStatus,
    timeRange: {
      since: since.toISOString(),
      until: until.toISOString(),
      durationHours: Math.round((until - since) / (1000 * 60 * 60))
    }
  }
}

/**
 * Calculate health status based on metrics
 */
function calculateHealthStatus(executions, toolResults) {
  const uptimeSeconds = Math.floor((Date.now() - APP_START_TIME) / 1000)
  
  // Determine health status
  let status = 'healthy'
  const issues = []
  
  // Check failure rate
  if (executions.total > 0) {
    const failureRate = (executions.failed / executions.total) * 100
    if (failureRate > 10) {
      status = 'degraded'
      issues.push(`High failure rate: ${failureRate.toFixed(2)}%`)
    }
    if (failureRate > 25) {
      status = 'unhealthy'
    }
  }
  
  // Check for tools with high failure rates
  for (const result of toolResults) {
    if (result.count >= 10) { // Only check tools with significant usage
      const toolFailureRate = (result.failed / result.count) * 100
      if (toolFailureRate > 20) {
        if (status === 'healthy') status = 'degraded'
        issues.push(`Tool '${result._id}' has ${toolFailureRate.toFixed(0)}% failure rate`)
      }
    }
  }
  
  // Check for pending approvals
  if (executions.pending > 5) {
    if (status === 'healthy') status = 'degraded'
    issues.push(`${executions.pending} executions pending approval`)
  }
  
  return {
    status,
    uptimeSeconds,
    uptimeHuman: formatUptime(uptimeSeconds),
    issues: issues.length > 0 ? issues : undefined,
    lastCheck: new Date().toISOString()
  }
}

/**
 * Format uptime in human readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`)
  
  return parts.join(' ')
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request) {
  const startTime = Date.now()
  
  try {
    // 1. Verify authentication
    const auth = verifyAuth(request)
    if (!auth.valid) {
      log('warn', `Auth failed: ${auth.error}`)
      return NextResponse.json({
        ok: false,
        error: { 
          code: 'AUTH_FAILED', 
          message: auth.error,
          help: auth.help
        },
        _meta: { version: VERSION }
      }, { status: 401 })
    }
    
    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'
    
    // Parse time range
    const now = new Date()
    let since, until
    
    const sinceParam = searchParams.get('since')
    if (sinceParam) {
      since = new Date(sinceParam)
      if (isNaN(since.getTime())) {
        return NextResponse.json({
          ok: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Invalid since parameter',
            help: 'Provide a valid ISO date string'
          },
          _meta: { version: VERSION }
        }, { status: 400 })
      }
    } else {
      since = new Date(now.getTime() - DEFAULT_TIME_RANGE_MS)
    }
    
    const untilParam = searchParams.get('until')
    if (untilParam) {
      until = new Date(untilParam)
      if (isNaN(until.getTime())) {
        return NextResponse.json({
          ok: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Invalid until parameter',
            help: 'Provide a valid ISO date string'
          },
          _meta: { version: VERSION }
        }, { status: 400 })
      }
    } else {
      until = now
    }
    
    // 3. Check cache
    const cacheKey = generateCacheKey(since, until)
    
    if (!refresh && isCacheValid(cacheKey)) {
      log('info', 'Returning cached metrics', { 
        cacheAge: Date.now() - metricsCache.generatedAt,
        keyId: auth.keyId 
      })
      
      return NextResponse.json({
        ok: true,
        metrics: metricsCache.data,
        generatedAt: new Date(metricsCache.generatedAt).toISOString(),
        cached: true,
        cacheAge: `${Math.round((Date.now() - metricsCache.generatedAt) / 1000)}s`,
        _meta: {
          version: VERSION,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      })
    }
    
    // 4. Connect to database
    const database = await connect()
    
    log('info', 'Calculating metrics', { 
      since: since.toISOString(),
      until: until.toISOString(),
      refresh,
      keyId: auth.keyId 
    })
    
    // 5. Calculate metrics
    const metrics = await calculateMetrics(database, since, until)
    
    // 6. Update cache
    metricsCache = {
      data: metrics,
      generatedAt: Date.now(),
      cacheKey
    }
    
    const durationMs = Date.now() - startTime
    
    log('info', `Metrics calculated`, { 
      total: metrics.executions.total,
      durationMs,
      keyId: auth.keyId 
    })
    
    return NextResponse.json({
      ok: true,
      metrics,
      generatedAt: new Date().toISOString(),
      cached: false,
      _meta: {
        version: VERSION,
        durationMs,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    log('error', `Unhandled error: ${error.message}`, {
      stack: error.stack?.split('\n').slice(0, 3).join(' | ')
    })
    
    return NextResponse.json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        details: { message: error.message }
      },
      _meta: { version: VERSION }
    }, { status: 500 })
  }
}

// ============================================================================
// OPTIONS Handler - CORS
// ============================================================================

export async function OPTIONS() {
  return new Response(null, { 
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-book8-internal-secret'
    }
  })
}
