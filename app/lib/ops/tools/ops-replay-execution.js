/**
 * Tool: ops.replayExecution
 * 
 * Replay a previous execution with optional overrides.
 * Loads execution record, applies overrides, and re-executes.
 * 
 * Category: ops
 * Risk: medium
 * Mutates: depends on replayed tool
 * Requires Approval: false (inherits from replayed tool)
 * Supports Plan Mode: true
 */

import { z } from 'zod'
import { COLLECTION_NAME as EVENT_LOG_COLLECTION } from '@/lib/schemas/opsEventLog'
import { getTool, validateToolArgs, executeTool } from '../registry.js'
import { getToolFromRegistry } from '../tool-registry.js'

export const name = 'ops.replayExecution'

export const description = 'Replay a previous execution with optional overrides - supports plan mode'

export const schema = z.object({
  requestId: z.string().min(1, 'requestId is required').describe('The requestId of the execution to replay'),
  mode: z.enum(['plan', 'execute']).default('plan').describe('plan = preview replay, execute = run replay'),
  overrideMeta: z.record(z.string(), z.any()).optional().describe('Override meta values for the replay'),
  overridePayload: z.record(z.string(), z.any()).optional().describe('Override payload values for the replay')
})

/**
 * Execute ops.replayExecution
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { requestId: targetRequestId, mode = 'plan', overrideMeta, overridePayload } = args
  const { db, requestId: currentRequestId, dryRun } = ctx
  
  console.log(`[ops:${currentRequestId}] ops.replayExecution: ${mode} mode for ${targetRequestId}`)
  
  // 1. Load the original execution from event logs
  const eventLogsCollection = db.collection(EVENT_LOG_COLLECTION)
  const originalExecution = await eventLogsCollection.findOne({ requestId: targetRequestId })
  
  if (!originalExecution) {
    return {
      ok: false,
      error: {
        code: 'EXECUTION_NOT_FOUND',
        message: `No execution found with requestId: ${targetRequestId}`
      }
    }
  }
  
  // 2. Extract original tool and payload
  const originalTool = originalExecution.tool
  const originalInput = originalExecution.input || originalExecution.metadata?.payload || {}
  const originalMeta = originalExecution.metadata || {}
  
  // 3. Verify the tool still exists in registry
  const toolDef = getToolFromRegistry(originalTool)
  if (!toolDef) {
    return {
      ok: false,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Tool '${originalTool}' no longer exists in registry`
      }
    }
  }
  
  // Check if tool is deprecated
  if (toolDef.deprecated) {
    console.log(`[ops:${currentRequestId}] ops.replayExecution: Warning - tool '${originalTool}' is deprecated`)
  }
  
  // 4. Build replay payload with overrides
  const replayPayload = {
    ...originalInput,
    ...(overridePayload || {})
  }
  
  const replayMeta = {
    ...originalMeta,
    ...(overrideMeta || {}),
    isReplay: true,
    originalRequestId: targetRequestId,
    replayRequestId: currentRequestId
  }
  
  // 5. Validate the replay payload against tool schema
  const tool = getTool(originalTool)
  if (!tool) {
    return {
      ok: false,
      error: {
        code: 'TOOL_NOT_REGISTERED',
        message: `Tool '${originalTool}' is not registered in executor`
      }
    }
  }
  
  const validation = validateToolArgs(originalTool, replayPayload)
  if (!validation.valid) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Replay payload validation failed',
        errors: validation.errors
      },
      replay: {
        tool: originalTool,
        originalPayload: originalInput,
        replayPayload,
        overrides: {
          meta: overrideMeta,
          payload: overridePayload
        }
      }
    }
  }
  
  // 6. Build replay summary
  const replaySummary = {
    originalExecution: {
      requestId: targetRequestId,
      tool: originalTool,
      status: originalExecution.status,
      executedAt: originalExecution.executedAt,
      durationMs: originalExecution.durationMs,
      businessId: originalExecution.businessId
    },
    replay: {
      tool: originalTool,
      payload: replayPayload,
      meta: replayMeta,
      overridesApplied: {
        meta: overrideMeta ? Object.keys(overrideMeta) : [],
        payload: overridePayload ? Object.keys(overridePayload) : []
      }
    },
    toolInfo: {
      deprecated: toolDef.deprecated || false,
      deprecatedReason: toolDef.deprecatedReason,
      replacedBy: toolDef.replacedBy,
      risk: toolDef.risk,
      mutates: toolDef.mutates,
      requiresApproval: toolDef.requiresApproval
    }
  }
  
  // 7. If plan mode, return the replay plan without executing
  if (mode === 'plan' || dryRun) {
    console.log(`[ops:${currentRequestId}] ops.replayExecution: Plan generated for ${originalTool}`)
    
    return {
      ok: true,
      mode: 'plan',
      executed: false,
      summary: replaySummary,
      nextStep: toolDef.requiresApproval
        ? `Tool '${originalTool}' requires approval. Submit mode="execute" after approval.`
        : `Submit with mode="execute" to replay this execution`,
      warnings: toolDef.deprecated
        ? [`Tool '${originalTool}' is deprecated. Consider using '${toolDef.replacedBy}' instead.`]
        : undefined
    }
  }
  
  // 8. Execute mode - run the replay
  console.log(`[ops:${currentRequestId}] ops.replayExecution: Executing replay of ${originalTool}`)
  
  try {
    // Create execution context for the replay
    const replayCtx = {
      ...ctx,
      requestId: currentRequestId,
      dryRun: false,
      isReplay: true,
      originalRequestId: targetRequestId
    }
    
    // Execute the tool
    const startTime = Date.now()
    const result = await executeTool(originalTool, validation.data, replayCtx)
    const durationMs = Date.now() - startTime
    
    console.log(`[ops:${currentRequestId}] ops.replayExecution: Replay completed in ${durationMs}ms`)
    
    return {
      ok: result.ok !== false,
      mode: 'execute',
      executed: true,
      summary: replaySummary,
      result,
      execution: {
        requestId: currentRequestId,
        durationMs,
        completedAt: new Date().toISOString()
      },
      warnings: toolDef.deprecated
        ? [`Tool '${originalTool}' is deprecated. Consider using '${toolDef.replacedBy}' instead.`]
        : undefined
    }
    
  } catch (error) {
    console.error(`[ops:${currentRequestId}] ops.replayExecution: Error - ${error.message}`)
    
    return {
      ok: false,
      mode: 'execute',
      executed: false,
      summary: replaySummary,
      error: {
        code: 'REPLAY_EXECUTION_ERROR',
        message: error.message,
        type: error.constructor?.name
      }
    }
  }
}
