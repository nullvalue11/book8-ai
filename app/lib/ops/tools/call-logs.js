/**
 * Tool: call_logs
 * 
 * Query call logs for a business within a date range.
 * Read-only tool for retrieving call history and analytics.
 * 
 * Category: voice
 * Risk: low
 * Mutates: false
 * Requires Approval: false
 */

import { z } from 'zod'

export const name = 'call_logs'

export const description = 'Query call logs for a business within a date range. Returns call history with details like duration, status, and timestamps.'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  startDate: z.string().optional().describe('Start date in ISO format (e.g., 2024-01-01). Defaults to 30 days ago.'),
  endDate: z.string().optional().describe('End date in ISO format (e.g., 2024-01-31). Defaults to now.'),
  limit: z.number().min(1).max(1000).default(100).describe('Maximum number of logs to return'),
  status: z.enum(['all', 'completed', 'failed', 'missed', 'in_progress']).default('all').describe('Filter by call status'),
  sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order by timestamp')
})

/**
 * Execute call_logs query
 * 
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context { db, requestId, dryRun, mode }
 * @returns {Promise<object>} Call logs result
 */
export async function execute(args, ctx) {
  const { 
    businessId, 
    startDate, 
    endDate, 
    limit = 100, 
    status = 'all',
    sortOrder = 'desc'
  } = args
  const { db, requestId, dryRun = false, mode = 'execute' } = ctx
  
  console.log(`[ops:${requestId}] call_logs: Querying logs for business ${businessId} (mode=${mode}, dryRun=${dryRun})`)
  
  // Plan mode - return what would be done
  if (mode === 'plan') {
    return buildPlan(args, ctx)
  }
  
  // Dry run mode - simulate without executing
  if (dryRun) {
    return buildDryRunResult(args, ctx)
  }
  
  // Execute actual query
  return executeQuery(args, ctx)
}

/**
 * Build execution plan
 */
function buildPlan(args, ctx) {
  const { businessId, startDate, endDate, limit, status, sortOrder } = args
  const { requestId } = ctx
  
  // Calculate date range
  const now = new Date()
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  
  const effectiveStartDate = startDate ? new Date(startDate) : defaultStartDate
  const effectiveEndDate = endDate ? new Date(endDate) : now
  
  console.log(`[ops:${requestId}] call_logs: Plan generated`)
  
  return {
    ok: true,
    businessId,
    mode: 'plan',
    executed: false,
    plan: {
      query: {
        collection: 'call_logs',
        businessId,
        dateRange: {
          start: effectiveStartDate.toISOString(),
          end: effectiveEndDate.toISOString()
        },
        statusFilter: status,
        limit,
        sortOrder
      },
      estimatedDurationMs: 50,
      description: `Query up to ${limit} call logs for business ${businessId} from ${effectiveStartDate.toISOString()} to ${effectiveEndDate.toISOString()}`
    },
    recommendations: [
      'Execute without plan mode to retrieve actual call logs',
      'Use startDate and endDate to narrow down results for better performance'
    ]
  }
}

/**
 * Build dry run result
 */
function buildDryRunResult(args, ctx) {
  const { businessId, limit } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] call_logs: Dry run - showing what would be done`)
  
  return {
    ok: true,
    businessId,
    mode: 'dryRun',
    executed: false,
    wouldExecute: {
      collection: 'call_logs',
      operation: 'find',
      limit
    },
    simulatedResult: {
      logs: [],
      totalCount: 'would_be_counted',
      summary: {
        completed: 'would_be_counted',
        failed: 'would_be_counted',
        totalDurationMinutes: 'would_be_calculated'
      }
    },
    recommendations: ['Execute without dryRun to see actual results']
  }
}

/**
 * Execute actual query
 */
async function executeQuery(args, ctx) {
  const { 
    businessId, 
    startDate, 
    endDate, 
    limit = 100, 
    status = 'all',
    sortOrder = 'desc'
  } = args
  const { db, requestId } = ctx
  
  const startTime = Date.now()
  
  // Calculate date range
  const now = new Date()
  const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  
  const effectiveStartDate = startDate ? new Date(startDate) : defaultStartDate
  const effectiveEndDate = endDate ? new Date(endDate) : now
  
  // Build query
  const query = {
    businessId,
    createdAt: {
      $gte: effectiveStartDate,
      $lte: effectiveEndDate
    }
  }
  
  // Add status filter if not 'all'
  if (status !== 'all') {
    query.status = status
  }
  
  console.log(`[ops:${requestId}] call_logs: Querying collection with filter`, { 
    businessId, 
    dateRange: { start: effectiveStartDate, end: effectiveEndDate },
    status,
    limit 
  })
  
  try {
    const collection = db.collection('call_logs')
    
    // Get logs with sorting and limit
    const logs = await collection
      .find(query)
      .sort({ createdAt: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit)
      .toArray()
    
    // Get total count (for pagination info)
    const totalCount = await collection.countDocuments(query)
    
    // Calculate summary statistics
    const summary = calculateSummary(logs)
    
    const durationMs = Date.now() - startTime
    
    console.log(`[ops:${requestId}] call_logs: Found ${logs.length} logs (total: ${totalCount}) in ${durationMs}ms`)
    
    // Clean up logs for response (remove internal fields)
    const cleanedLogs = logs.map(log => ({
      id: log.id || log._id?.toString(),
      businessId: log.businessId,
      callId: log.callId,
      agentId: log.agentId,
      phoneNumber: log.phoneNumber,
      direction: log.direction || 'outbound',
      status: log.status,
      durationSeconds: log.durationSeconds || 0,
      startedAt: log.startedAt || log.createdAt,
      endedAt: log.endedAt,
      createdAt: log.createdAt,
      summary: log.summary,
      cost: log.cost,
      metadata: log.metadata
    }))
    
    return {
      ok: true,
      businessId,
      dateRange: {
        start: effectiveStartDate.toISOString(),
        end: effectiveEndDate.toISOString()
      },
      logs: cleanedLogs,
      pagination: {
        returned: logs.length,
        total: totalCount,
        limit,
        hasMore: totalCount > limit
      },
      summary,
      _meta: {
        durationMs,
        query: {
          status,
          sortOrder
        }
      }
    }
    
  } catch (err) {
    console.error(`[ops:${requestId}] call_logs: Query failed:`, err)
    
    return {
      ok: false,
      businessId,
      error: {
        code: 'QUERY_FAILED',
        message: err.message
      },
      logs: [],
      pagination: {
        returned: 0,
        total: 0,
        limit,
        hasMore: false
      }
    }
  }
}

/**
 * Calculate summary statistics from logs
 */
function calculateSummary(logs) {
  if (!logs || logs.length === 0) {
    return {
      totalCalls: 0,
      completed: 0,
      failed: 0,
      missed: 0,
      inProgress: 0,
      totalDurationSeconds: 0,
      totalDurationMinutes: 0,
      averageDurationSeconds: 0,
      totalCost: 0
    }
  }
  
  const stats = {
    totalCalls: logs.length,
    completed: 0,
    failed: 0,
    missed: 0,
    inProgress: 0,
    totalDurationSeconds: 0,
    totalCost: 0
  }
  
  for (const log of logs) {
    // Count by status
    switch (log.status) {
      case 'completed':
        stats.completed++
        break
      case 'failed':
        stats.failed++
        break
      case 'missed':
        stats.missed++
        break
      case 'in_progress':
        stats.inProgress++
        break
    }
    
    // Sum duration
    if (log.durationSeconds) {
      stats.totalDurationSeconds += log.durationSeconds
    }
    
    // Sum cost
    if (log.cost) {
      stats.totalCost += parseFloat(log.cost) || 0
    }
  }
  
  stats.totalDurationMinutes = Math.round(stats.totalDurationSeconds / 60 * 100) / 100
  stats.averageDurationSeconds = Math.round(stats.totalDurationSeconds / stats.totalCalls * 100) / 100
  stats.totalCost = Math.round(stats.totalCost * 100) / 100
  
  return stats
}
