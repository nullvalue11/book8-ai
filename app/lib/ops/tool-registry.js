/**
 * Ops Tool Registry - Shared Tool Definitions
 * 
 * This is the SINGLE SOURCE OF TRUTH for all ops tools.
 * Both /api/internal/ops/tools and /api/internal/ops/execute use this registry.
 * 
 * Rule: "If it's not in this registry, it can't be executed."
 * 
 * @module lib/ops/registry
 */

// =============================================================================
// Tool Registry - The Source of Truth
// =============================================================================

export const TOOL_REGISTRY = [
  // =========================================================================
  // CANONICAL TOOLS (Use these)
  // =========================================================================
  {
    name: 'tenant.bootstrap',
    description: 'Complete tenant onboarding - THE canonical path for creating and validating tenants. Orchestrates tenant creation, billing validation, voice testing, and provisioning summary in a single atomic operation.',
    category: 'tenant',
    mutates: true,
    risk: 'medium',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api', 'mcp'],
    requiresApproval: false,
    deprecated: false,
    canonicalFor: 'tenant-onboarding',
    replaces: ['tenant.ensure', 'billing.validateStripeConfig', 'voice.smokeTest', 'tenant.provisioningSummary'],
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { 
          type: 'string', 
          description: 'Unique business identifier',
          minLength: 1
        },
        name: { 
          type: 'string', 
          description: 'Business display name (used if creating new tenant)'
        },
        skipVoiceTest: { 
          type: 'boolean', 
          default: false,
          description: 'Skip voice smoke test for faster execution'
        },
        skipBillingCheck: { 
          type: 'boolean', 
          default: false,
          description: 'Skip Stripe validation'
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'ready'],
      properties: {
        ok: { type: 'boolean', description: 'Did execution complete without errors?' },
        ready: { type: 'boolean', description: 'Is tenant fully operational?' },
        readyMessage: { type: 'string', description: 'Human-readable status' },
        checklist: { 
          type: 'array', 
          description: 'Step-by-step execution results',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              item: { type: 'string' },
              status: { type: 'string', enum: ['done', 'warning', 'in_progress', 'skipped', 'failed'] },
              details: { type: 'string' }
            }
          }
        },
        recommendations: { type: 'array', description: 'Suggested next actions' },
        stats: { 
          type: 'object',
          properties: {
            totalSteps: { type: 'number' },
            completed: { type: 'number' },
            warnings: { type: 'number' },
            skipped: { type: 'number' },
            failed: { type: 'number' }
          }
        }
      }
    },
    examples: [
      {
        name: 'Basic bootstrap',
        input: { businessId: 'biz_abc123' },
        description: 'Run full bootstrap with all checks'
      },
      {
        name: 'Fast bootstrap',
        input: { businessId: 'biz_abc123', skipVoiceTest: true, skipBillingCheck: true },
        description: 'Quick bootstrap skipping optional checks (~15ms vs ~400ms)'
      }
    ],
    documentation: '/docs/tenant-bootstrap-canonical.md'
  },

  // =========================================================================
  // HIGH-RISK TOOLS (Require approval)
  // =========================================================================
  {
    name: 'tenant.delete',
    description: '🔴 HIGH-RISK: Permanently delete a tenant and all associated data. Requires approval.',
    category: 'tenant',
    mutates: true,
    risk: 'high',
    dryRunSupported: true,
    allowedCallers: ['human', 'api'], // No n8n - manual only
    requiresApproval: true,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['businessId', 'confirmationCode'],
      properties: {
        businessId: { type: 'string', description: 'Business to delete' },
        confirmationCode: { type: 'string', description: 'Confirmation code for deletion' },
        reason: { type: 'string', description: 'Reason for deletion' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        deletedAt: { type: 'string' },
        affectedRecords: { type: 'number' }
      }
    }
  },

  // =========================================================================
  // GOLDEN WORKFLOWS - High-value operations
  // =========================================================================
  {
    name: 'tenant.recovery',
    description: 'Diagnose and recover unhealthy tenants by re-validating voice configuration, billing status, and re-running provisioning checks. Use this when a tenant reports issues or after infrastructure changes.',
    category: 'tenant',
    mutates: true,
    risk: 'medium',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'ops_console', 'api'],
    requiresApproval: false,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { 
          type: 'string', 
          description: 'Unique business identifier',
          minLength: 1
        },
        runVoiceTest: { 
          type: 'boolean', 
          default: true,
          description: 'Run voice diagnostics'
        },
        recheckBilling: { 
          type: 'boolean', 
          default: true,
          description: 'Re-check billing/Stripe status'
        },
        autoFix: { 
          type: 'boolean', 
          default: false,
          description: 'If true, attempt to fix issues found'
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'businessId', 'recoveryStatus'],
      properties: {
        ok: { type: 'boolean', description: 'Did the recovery check complete successfully?' },
        businessId: { type: 'string' },
        recoveryStatus: { 
          type: 'string', 
          enum: ['healthy', 'recovered', 'needs_attention', 'failed'],
          description: 'Overall recovery status'
        },
        issuesFound: { type: 'number', description: 'Number of issues detected' },
        issuesFixed: { type: 'number', description: 'Number of issues automatically fixed' },
        checks: {
          type: 'object',
          properties: {
            voice: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                latencyMs: { type: 'number' },
                error: { type: 'string' }
              }
            },
            billing: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                valid: { type: 'boolean' },
                error: { type: 'string' }
              }
            },
            provisioning: {
              type: 'object',
              properties: {
                ready: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        },
        actions: { type: 'array', items: { type: 'string' }, description: 'Actions taken if autoFix=true' },
        recommendations: { type: 'array', items: { type: 'string' }, description: 'Suggested next steps' }
      }
    },
    examples: [
      {
        name: 'Plan recovery',
        input: { businessId: 'biz_abc123' },
        description: 'Preview what recovery checks would run (use mode: plan)'
      },
      {
        name: 'Basic recovery check',
        input: { businessId: 'biz_abc123', autoFix: false },
        description: 'Run full diagnostics without auto-fix'
      },
      {
        name: 'Recovery with auto-fix',
        input: { businessId: 'biz_abc123', autoFix: true },
        description: 'Run diagnostics and attempt to fix issues'
      },
      {
        name: 'Quick check (skip voice)',
        input: { businessId: 'biz_abc123', runVoiceTest: false, recheckBilling: true },
        description: 'Fast recovery check without voice latency tests'
      }
    ],
    documentation: '/docs/tenant-recovery-golden-workflow.md'
  },

  // =========================================================================
  // V1 TOOL PACK - Read-Only Tools
  // =========================================================================
  {
    name: 'tenant.status',
    description: 'Read-only tenant status check - returns comprehensive status without mutation',
    category: 'tenant',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api', 'mcp'],
    requiresApproval: false,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { 
          type: 'string', 
          description: 'Unique business identifier',
          minLength: 1
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'businessId', 'summary', 'checks'],
      properties: {
        ok: { type: 'boolean', description: 'Did the check complete successfully?' },
        businessId: { type: 'string' },
        summary: {
          type: 'object',
          properties: {
            ready: { type: 'boolean', description: 'Is tenant fully operational?' },
            readyMessage: { type: 'string', description: 'Human-readable status' }
          }
        },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              item: { type: 'string' },
              status: { type: 'string', enum: ['passed', 'failed', 'warning', 'info'] },
              details: { type: 'string' }
            }
          }
        },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    },
    examples: [
      {
        name: 'Check tenant status',
        input: { businessId: 'biz_abc123' },
        description: 'Get comprehensive status check for a tenant'
      }
    ]
  },
  {
    name: 'call_logs',
    description: 'Query call logs for a business within a date range. Returns call history with details like duration, status, and timestamps.',
    category: 'voice',
    mutates: false,
    risk: 'low',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'ops_console', 'api', 'mcp'],
    requiresApproval: false,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { 
          type: 'string', 
          description: 'Unique business identifier',
          minLength: 1
        },
        startDate: { 
          type: 'string', 
          description: 'Start date in ISO format (e.g., 2024-01-01). Defaults to 30 days ago.'
        },
        endDate: { 
          type: 'string', 
          description: 'End date in ISO format (e.g., 2024-01-31). Defaults to now.'
        },
        limit: { 
          type: 'number', 
          minimum: 1,
          maximum: 1000,
          default: 100,
          description: 'Maximum number of logs to return'
        },
        status: { 
          type: 'string', 
          enum: ['all', 'completed', 'failed', 'missed', 'in_progress'],
          default: 'all',
          description: 'Filter by call status'
        },
        sortOrder: { 
          type: 'string', 
          enum: ['asc', 'desc'],
          default: 'desc',
          description: 'Sort order by timestamp'
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'businessId', 'logs'],
      properties: {
        ok: { type: 'boolean', description: 'Did the query complete successfully?' },
        businessId: { type: 'string' },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' }
          }
        },
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              businessId: { type: 'string' },
              callId: { type: 'string' },
              agentId: { type: 'string' },
              phoneNumber: { type: 'string' },
              direction: { type: 'string', enum: ['inbound', 'outbound'] },
              status: { type: 'string' },
              durationSeconds: { type: 'number' },
              startedAt: { type: 'string' },
              endedAt: { type: 'string' },
              createdAt: { type: 'string' },
              summary: { type: 'string' },
              cost: { type: 'number' }
            }
          }
        },
        pagination: {
          type: 'object',
          properties: {
            returned: { type: 'number' },
            total: { type: 'number' },
            limit: { type: 'number' },
            hasMore: { type: 'boolean' }
          }
        },
        summary: {
          type: 'object',
          properties: {
            totalCalls: { type: 'number' },
            completed: { type: 'number' },
            failed: { type: 'number' },
            missed: { type: 'number' },
            inProgress: { type: 'number' },
            totalDurationMinutes: { type: 'number' },
            averageDurationSeconds: { type: 'number' },
            totalCost: { type: 'number' }
          }
        }
      }
    },
    examples: [
      {
        name: 'Get recent call logs',
        input: { businessId: 'biz_abc123' },
        description: 'Get last 100 call logs from past 30 days'
      },
      {
        name: 'Get call logs for date range',
        input: { businessId: 'biz_abc123', startDate: '2024-01-01', endDate: '2024-01-31', limit: 50 },
        description: 'Get up to 50 call logs for January 2024'
      },
      {
        name: 'Get failed calls only',
        input: { businessId: 'biz_abc123', status: 'failed', limit: 20 },
        description: 'Get last 20 failed calls for debugging'
      }
    ]
  },
  {
    name: 'voice.diagnostics',
    description: 'Voice service diagnostics - checks latency and connectivity to voice targets',
    category: 'voice',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api', 'mcp'],
    requiresApproval: false,
    deprecated: false,
    inputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string', description: 'Optional business context for logging' },
        targets: {
          type: 'array',
          description: 'Custom targets to check (defaults to voice service endpoints)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              url: { type: 'string' },
              type: { type: 'string', enum: ['health', 'auth', 'ping'] },
              requiresKey: { type: 'string' }
            }
          }
        },
        timeoutMs: { type: 'number', minimum: 100, maximum: 30000, default: 5000, description: 'Timeout per target in milliseconds' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'overallStatus', 'results'],
      properties: {
        ok: { type: 'boolean' },
        businessId: { type: 'string' },
        overallStatus: { type: 'string', enum: ['healthy', 'degraded', 'critical', 'unknown'] },
        statusReason: { type: 'string' },
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            healthy: { type: 'number' },
            unhealthy: { type: 'number' },
            skipped: { type: 'number' },
            avgLatencyMs: { type: 'number' },
            totalDurationMs: { type: 'number' }
          }
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              target: { type: 'string' },
              url: { type: 'string' },
              status: { type: 'string' },
              reason: { type: 'string' },
              latencyMs: { type: 'number' }
            }
          }
        }
      }
    },
    examples: [
      {
        name: 'Basic voice diagnostics',
        input: {},
        description: 'Check all default voice service targets'
      },
      {
        name: 'Quick diagnostics with timeout',
        input: { timeoutMs: 2000 },
        description: 'Fast check with 2 second timeout per target'
      }
    ]
  },

  // =========================================================================
  // V1 TOOL PACK - Mutating Tools (Require Approval)
  // =========================================================================
  {
    name: 'billing.syncPrices',
    description: 'Sync Stripe prices for a tenant - supports plan mode for preview, requires approval for execution',
    category: 'billing',
    mutates: true,
    risk: 'medium',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: true,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier for context', minLength: 1 },
        mode: { type: 'string', enum: ['plan', 'execute'], default: 'plan', description: 'plan = preview changes, execute = apply changes' },
        currency: { type: 'string', minLength: 3, maxLength: 3, default: 'usd', description: 'Currency code (lowercase)' },
        priceMap: {
          type: 'object',
          description: 'Map of price key to price config. If not provided, syncs from environment defaults.',
          additionalProperties: {
            type: 'object',
            properties: {
              unitAmount: { type: 'number', description: 'Amount in cents' },
              nickname: { type: 'string' },
              recurring: {
                type: 'object',
                properties: {
                  interval: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
                  intervalCount: { type: 'number', default: 1 }
                }
              },
              metadata: { type: 'object' }
            }
          }
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'businessId', 'mode', 'executed'],
      properties: {
        ok: { type: 'boolean' },
        businessId: { type: 'string' },
        mode: { type: 'string', enum: ['plan', 'execute'] },
        executed: { type: 'boolean' },
        plan: { type: 'array' },
        created: { type: 'array' },
        updated: { type: 'array' },
        noop: { type: 'array' },
        summary: {
          type: 'object',
          properties: {
            toCreate: { type: 'number' },
            toUpdate: { type: 'number' },
            noChange: { type: 'number' },
            total: { type: 'number' }
          }
        }
      }
    },
    examples: [
      {
        name: 'Plan price sync',
        input: { businessId: 'biz_abc123', mode: 'plan' },
        description: 'Preview price changes without applying'
      },
      {
        name: 'Execute price sync',
        input: { businessId: 'biz_abc123', mode: 'execute' },
        description: 'Apply price changes (requires approval)'
      }
    ]
  },
  {
    name: 'ops.replayExecution',
    description: 'Replay a previous execution with optional overrides - supports plan mode',
    category: 'ops',
    mutates: true,
    risk: 'medium',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: false,
    inputSchema: {
      type: 'object',
      required: ['requestId'],
      properties: {
        requestId: { type: 'string', description: 'The requestId of the execution to replay', minLength: 1 },
        mode: { type: 'string', enum: ['plan', 'execute'], default: 'plan', description: 'plan = preview replay, execute = run replay' },
        overrideMeta: { type: 'object', description: 'Override meta values for the replay' },
        overridePayload: { type: 'object', description: 'Override payload values for the replay' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['ok', 'mode', 'executed'],
      properties: {
        ok: { type: 'boolean' },
        mode: { type: 'string', enum: ['plan', 'execute'] },
        executed: { type: 'boolean' },
        summary: {
          type: 'object',
          properties: {
            originalExecution: { type: 'object' },
            replay: { type: 'object' },
            toolInfo: { type: 'object' }
          }
        },
        result: { type: 'object' },
        execution: { type: 'object' },
        warnings: { type: 'array', items: { type: 'string' } }
      }
    },
    examples: [
      {
        name: 'Plan replay',
        input: { requestId: 'req_abc123', mode: 'plan' },
        description: 'Preview what the replay would do'
      },
      {
        name: 'Execute replay with overrides',
        input: { requestId: 'req_abc123', mode: 'execute', overridePayload: { skipVoiceTest: true } },
        description: 'Replay execution with modified payload'
      }
    ]
  },

  // =========================================================================
  // DEPRECATED TOOLS (Do not use directly)
  // =========================================================================
  {
    name: 'tenant.ensure',
    description: '⚠️ DEPRECATED: Create or verify a business record exists. Use tenant.bootstrap instead.',
    category: 'tenant',
    mutates: true,
    risk: 'low',
    dryRunSupported: true,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Unique business identifier' },
        name: { type: 'string', description: 'Business display name' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        businessId: { type: 'string' },
        existed: { type: 'boolean' },
        created: { type: 'boolean' }
      }
    }
  },
  {
    name: 'billing.validateStripeConfig',
    description: '⚠️ DEPRECATED: Validate Stripe environment configuration. Use tenant.bootstrap instead.',
    category: 'billing',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier for context' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        stripeConfigured: { type: 'boolean' },
        stripeMode: { type: 'string', enum: ['test', 'live'] },
        checks: { type: 'array' }
      }
    }
  },
  {
    name: 'voice.smokeTest',
    description: '⚠️ DEPRECATED: Health check voice/AI calling services. Use tenant.bootstrap instead.',
    category: 'voice',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier for context' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        passed: { type: 'number' },
        total: { type: 'number' },
        checks: { type: 'array' }
      }
    }
  },
  {
    name: 'tenant.provisioningSummary',
    description: '⚠️ DEPRECATED: Get complete tenant provisioning state. Use tenant.bootstrap instead.',
    category: 'tenant',
    mutates: false,
    risk: 'low',
    dryRunSupported: false,
    allowedCallers: ['n8n', 'human', 'api'],
    requiresApproval: false,
    deprecated: true,
    deprecatedReason: 'Use tenant.bootstrap for complete onboarding',
    replacedBy: 'tenant.bootstrap',
    inputSchema: {
      type: 'object',
      required: ['businessId'],
      properties: {
        businessId: { type: 'string', description: 'Business identifier' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        provisioningScore: { type: 'number' },
        subscription: { type: 'object' },
        calendar: { type: 'object' },
        scheduling: { type: 'object' },
        voice: { type: 'object' }
      }
    }
  }
]

// =============================================================================
// Tool Categories
// =============================================================================

export const CATEGORIES = {
  tenant: {
    name: 'Tenant Management',
    description: 'Tools for creating, configuring, and managing tenants'
  },
  billing: {
    name: 'Billing & Payments',
    description: 'Tools for Stripe integration and payment validation'
  },
  voice: {
    name: 'Voice & AI Calling',
    description: 'Tools for voice agent testing and configuration'
  },
  ops: {
    name: 'Operations',
    description: 'Tools for system operations, replay, and diagnostics'
  },
  system: {
    name: 'System Operations',
    description: 'Tools for system-level operations and diagnostics'
  }
}

// =============================================================================
// Risk Levels
// =============================================================================

export const RISK_LEVELS = {
  low: {
    name: 'Low Risk',
    description: 'Read-only or minimal impact operations',
    requiresConfirmation: false
  },
  medium: {
    name: 'Medium Risk',
    description: 'Creates or modifies data, reversible',
    requiresConfirmation: false
  },
  high: {
    name: 'High Risk',
    description: 'Significant changes, may be difficult to reverse',
    requiresConfirmation: true
  }
}

// =============================================================================
// Registry Lookup Functions
// =============================================================================

/**
 * Get a tool definition by name from the registry
 * @param {string} toolName - The tool name to look up
 * @returns {object|null} Tool definition or null if not found
 */
export function getToolFromRegistry(toolName) {
  return TOOL_REGISTRY.find(t => t.name === toolName) || null
}

/**
 * Check if a tool exists in the registry
 * @param {string} toolName - The tool name to check
 * @returns {boolean}
 */
export function isToolInRegistry(toolName) {
  return TOOL_REGISTRY.some(t => t.name === toolName)
}

/**
 * Get all tool names from the registry
 * @param {boolean} includeDeprecated - Include deprecated tools
 * @returns {string[]}
 */
export function getRegisteredToolNames(includeDeprecated = true) {
  if (includeDeprecated) {
    return TOOL_REGISTRY.map(t => t.name)
  }
  return TOOL_REGISTRY.filter(t => !t.deprecated).map(t => t.name)
}

/**
 * Get canonical tools only (non-deprecated)
 * @returns {object[]}
 */
export function getCanonicalTools() {
  return TOOL_REGISTRY.filter(t => !t.deprecated)
}

/**
 * Get deprecated tools
 * @returns {object[]}
 */
export function getDeprecatedTools() {
  return TOOL_REGISTRY.filter(t => t.deprecated)
}

// =============================================================================
// Schema Validation Functions
// =============================================================================

/**
 * Validate input against a tool's inputSchema (JSON Schema style)
 * @param {object} input - The input to validate
 * @param {object} schema - The JSON schema to validate against
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgainstSchema(input, schema) {
  const errors = []
  
  if (!schema || schema.type !== 'object') {
    return { valid: true, errors: [] }
  }
  
  // Check required fields
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        errors.push(`Missing required field: ${field}`)
      }
    }
  }
  
  // Check property types and constraints
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const value = input[propName]
      
      // Skip undefined values (they're caught by required check)
      if (value === undefined) continue
      
      // Type validation
      if (propSchema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (propSchema.type !== actualType) {
          // Allow null for optional fields
          if (value !== null) {
            errors.push(`Field '${propName}' expected ${propSchema.type}, got ${actualType}`)
          }
        }
      }
      
      // String constraints
      if (propSchema.type === 'string' && typeof value === 'string') {
        if (propSchema.minLength && value.length < propSchema.minLength) {
          errors.push(`Field '${propName}' must be at least ${propSchema.minLength} characters`)
        }
        if (propSchema.maxLength && value.length > propSchema.maxLength) {
          errors.push(`Field '${propName}' must be at most ${propSchema.maxLength} characters`)
        }
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Field '${propName}' must be one of: ${propSchema.enum.join(', ')}`)
        }
      }
      
      // Number constraints
      if (propSchema.type === 'number' && typeof value === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          errors.push(`Field '${propName}' must be at least ${propSchema.minimum}`)
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          errors.push(`Field '${propName}' must be at most ${propSchema.maximum}`)
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate tool input against registry schema
 * @param {string} toolName - Tool name
 * @param {object} input - Input to validate
 * @returns {{ valid: boolean, errors: string[], tool: object|null }}
 */
export function validateToolInput(toolName, input) {
  const tool = getToolFromRegistry(toolName)
  
  if (!tool) {
    return {
      valid: false,
      errors: [`Tool '${toolName}' not found in registry`],
      tool: null
    }
  }
  
  if (!tool.inputSchema) {
    return { valid: true, errors: [], tool }
  }
  
  const validation = validateAgainstSchema(input, tool.inputSchema)
  return {
    ...validation,
    tool
  }
}

/**
 * Validate tool output against registry schema (logs warnings, doesn't block)
 * @param {string} toolName - Tool name
 * @param {object} output - Output to validate
 * @returns {{ valid: boolean, warnings: string[] }}
 */
export function validateToolOutput(toolName, output) {
  const tool = getToolFromRegistry(toolName)
  
  if (!tool || !tool.outputSchema) {
    return { valid: true, warnings: [] }
  }
  
  const validation = validateAgainstSchema(output, tool.outputSchema)
  
  // Convert errors to warnings for output validation
  return {
    valid: validation.valid,
    warnings: validation.errors.map(e => `Output schema warning: ${e}`)
  }
}

// =============================================================================
// Default Export
// =============================================================================

const toolRegistry = {
  TOOL_REGISTRY,
  CATEGORIES,
  RISK_LEVELS,
  getToolFromRegistry,
  isToolInRegistry,
  getRegisteredToolNames,
  getCanonicalTools,
  getDeprecatedTools,
  validateAgainstSchema,
  validateToolInput,
  validateToolOutput
}

export default toolRegistry
