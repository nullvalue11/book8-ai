/**
 * Ops Control Plane - Main Entry Point
 * 
 * Initializes the tool registry with all available tools.
 */

import { registerTool } from './registry.js'

// Import existing tools
import * as tenantEnsure from './tools/tenant-ensure.js'
import * as tenantBootstrap from './tools/tenant-bootstrap.js'
import * as billingValidateStripe from './tools/billing-validate-stripe.js'
import * as voiceSmokeTest from './tools/voice-smoke-test.js'
import * as tenantProvisioningSummary from './tools/tenant-provisioning-summary.js'

// Import V1 Tool Pack
import * as tenantStatus from './tools/tenant-status.js'
import * as voiceDiagnostics from './tools/voice-diagnostics.js'
import * as billingSyncPrices from './tools/billing-sync-prices.js'
import * as opsReplayExecution from './tools/ops-replay-execution.js'
import * as callLogs from './tools/call-logs.js'
import * as billingVerification from './tools/billing-verification.js'

// Import Golden Workflows
import * as tenantRecovery from './tools/tenant-recovery.js'

// Register all tools
const tools = [
  // Existing tools
  tenantEnsure,
  tenantBootstrap,
  billingValidateStripe,
  voiceSmokeTest,
  tenantProvisioningSummary,
  // V1 Tool Pack
  tenantStatus,
  voiceDiagnostics,
  billingSyncPrices,
  opsReplayExecution,
  callLogs,
  billingVerification,
  // Golden Workflows
  tenantRecovery
]

let initialized = false

export function initializeOps() {
  if (initialized) return
  
  for (const tool of tools) {
    registerTool(tool.name, {
      schema: tool.schema,
      execute: tool.execute,
      description: tool.description
    })
  }
  
  initialized = true
  console.log(`[ops] Initialized ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`)
}

// Re-export registry functions
export { getTool, isToolAllowed, getToolNames, validateToolArgs, executeTool } from './registry.js'

// Re-export audit functions
export { redactSensitiveData, createAuditEntry, saveAuditLog, getAuditLog } from './audit.js'

// Re-export idempotency functions
export { getCachedResult, storeResult, acquireLock, releaseLock } from './idempotency.js'
