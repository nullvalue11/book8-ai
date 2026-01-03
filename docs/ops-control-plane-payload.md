# Ops Control Plane API Documentation

> **Version:** v1.3.0  
> **Endpoint:** `POST /api/internal/ops/execute`  
> **Authentication:** `x-book8-internal-secret` header

---

## ⚡ Canonical Onboarding Path

> **Rule: "If you want a tenant, you call `tenant.bootstrap`. Period."**

### The Only Supported Path

`tenant.bootstrap` is the **ONLY** supported method for tenant onboarding in workflows and integrations. This single tool orchestrates the complete onboarding process atomically.

```
┌─────────────────────────────────────────────────────────────┐
│                    tenant.bootstrap                          │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│   │tenant.ensure │→ │billing.check │→ │voice.smoke   │→ ... │
│   └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│   One call. One response. Complete visibility.               │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ Deprecated Tools (Do Not Use Directly)

The following tools are **DEPRECATED** for direct workflow use:

| Tool | Status | Use Instead |
|------|--------|-------------|
| `tenant.ensure` | ⚠️ **DEPRECATED** | `tenant.bootstrap` |
| `billing.validateStripeConfig` | ⚠️ **DEPRECATED** | `tenant.bootstrap` |
| `voice.smokeTest` | ⚠️ **DEPRECATED** | `tenant.bootstrap` |
| `tenant.provisioningSummary` | ⚠️ **DEPRECATED** | `tenant.bootstrap` |

**Why these tools still exist:**
- Internal building blocks for `tenant.bootstrap`
- Debugging and diagnostics (admin use only)
- Legacy support during migration period

**Why you should NOT call them directly:**
- Multiple API calls = rate limiting issues
- No consolidated readiness status
- Increased workflow complexity
- No atomic operation guarantees
- Harder to debug failures

### Migration Path

❌ **Old Way (Deprecated):**
```
[tenant.ensure] → [billing.validateStripeConfig] → [voice.smokeTest] → [tenant.provisioningSummary]
     ↓                    ↓                              ↓                        ↓
  4 API calls, 4 error handlers, complex branching logic
```

✅ **New Way (Required):**
```
[tenant.bootstrap]
     ↓
  1 API call, 1 response, complete status
```

---

## 📋 Readiness Contract

The `tenant.bootstrap` tool provides a **guaranteed response contract** that workflows can depend on.

### Guaranteed Response Shape

Every successful `tenant.bootstrap` call returns this exact structure:

```typescript
{
  ok: true,
  result: {
    // Core readiness indicator
    ready: boolean,           // THE key field - is tenant operational?
    readyMessage: string,     // Human-readable status
    
    // Detailed breakdown
    checklist: [              // Always exactly 4 items (or fewer if skipped)
      {
        step: number,         // 1-4
        item: string,         // "Tenant Record", "Billing Configuration", etc.
        tool: string,         // Internal tool name
        status: "done" | "warning" | "in_progress" | "skipped" | "failed",
        details: string,      // Human-readable details
        durationMs: number    // Execution time
      }
    ],
    
    // Actionable guidance
    recommendations: [
      {
        priority: "high" | "medium" | "low",
        item: string,
        message: string
      }
    ],
    
    // Full diagnostic data
    details: {
      tenant: { businessId, existed, created },
      billing: { stripeConfigured, stripeMode, checks },
      voice: { passed, total, checks },
      provisioning: { exists, score, subscription, calendar, scheduling }
    },
    
    // Aggregate stats
    stats: {
      totalSteps: number,
      completed: number,
      warnings: number,
      skipped: number,
      failed: number
    }
  }
}
```

### What `ready: true` Means

When `ready: true`, you have a **guarantee** that:

| Guarantee | Description |
|-----------|-------------|
| ✅ Tenant exists | Business record is in the database |
| ✅ No failures | All critical steps completed without `status: "failed"` |
| ✅ Operational | Tenant can receive bookings and use core features |
| ✅ Queryable | Tenant data is available for API queries |

**Operational meaning:** The tenant is fully provisioned and operational. Workflows can proceed with confidence.

```javascript
// n8n decision logic
if ($json.result.ready === true) {
  // ✅ Proceed with onboarding flow
  // Send welcome email, enable features, etc.
} else {
  // ⚠️ Tenant needs attention
  // Route to manual review or retry logic
}
```

### What `ready: false` Means

When `ready: false`, the tenant **requires attention**:

| Condition | Meaning | Action Required |
|-----------|---------|-----------------|
| `status: "failed"` in checklist | Critical step failed | Investigate error, retry, or escalate |
| Tenant not found | Database issue | Check tenant.ensure step details |
| Multiple warnings | Non-critical issues | Review recommendations array |

**Operational meaning:** Do NOT proceed with normal onboarding. Use the checklist and recommendations to diagnose.

### Using the Checklist for Debugging

The `checklist` array provides step-by-step visibility:

```javascript
// Find the failing step
const failedStep = $json.result.checklist.find(c => c.status === 'failed');
if (failedStep) {
  console.log(`Step ${failedStep.step} failed: ${failedStep.item}`);
  console.log(`Details: ${failedStep.details}`);
  console.log(`Tool: ${failedStep.tool}`);
}

// Get all warnings
const warnings = $json.result.checklist.filter(c => c.status === 'warning');
warnings.forEach(w => {
  console.log(`Warning at step ${w.step}: ${w.details}`);
});
```

### Using the Checklist for UI Flows

Display onboarding progress to users:

```javascript
// Progress indicator
const { stats } = $json.result;
const progressPercent = (stats.completed / stats.totalSteps) * 100;

// Step-by-step status for UI
const steps = $json.result.checklist.map(c => ({
  name: c.item,
  complete: c.status === 'done',
  warning: c.status === 'warning',
  inProgress: c.status === 'in_progress',
  skipped: c.status === 'skipped',
  failed: c.status === 'failed',
  message: c.details
}));
```

### Recommendations Priority

The `recommendations` array is sorted by priority:

| Priority | Meaning | UI Treatment |
|----------|---------|--------------|
| `high` | Blocks key functionality | Show prominently, prompt immediate action |
| `medium` | Degrades experience | Show in setup wizard |
| `low` | Nice-to-have | Show in settings/tips |

---

## Overview

The Ops Control Plane is a secure, internal-only API for executing predefined operational tasks in the Book8-AI platform. It provides:

- **Idempotent execution** via `requestId` to prevent duplicate processing
- **Audit logging** of all operations to MongoDB
- **Scoped API keys** for granular access control
- **Dry run mode** to preview actions without executing
- **Orchestrator tools** like `tenant.bootstrap` to reduce API call complexity

### Available Tools

| Tool | Description | Required Scope | Status |
|------|-------------|----------------|--------|
| `tenant.bootstrap` | **Orchestrator** - Run full tenant onboarding in one call | `tenant.write` | ✅ **RECOMMENDED** |
| `tenant.ensure` | Create or verify a business record exists | `tenant.write` | ⚠️ DEPRECATED |
| `billing.validateStripeConfig` | Validate Stripe environment configuration | `billing.read` | ⚠️ DEPRECATED |
| `voice.smokeTest` | Health check voice/AI calling services | `voice.test` | ⚠️ DEPRECATED |
| `tenant.provisioningSummary` | Get complete tenant provisioning state | `tenant.read` | ⚠️ DEPRECATED |

> ⚠️ **DEPRECATED tools** exist only as internal building blocks for `tenant.bootstrap` or for admin debugging. Do not use them directly in workflows.

---

## Request Format

The API supports two request formats for flexibility:

### Recommended Format (New)

```json
{
  "tool": "tenant.bootstrap",
  "payload": {
    "businessId": "biz_abc123",
    "name": "Acme Corp",
    "skipVoiceTest": false,
    "skipBillingCheck": false
  },
  "meta": {
    "requestId": "req_unique_id_here",
    "dryRun": false,
    "actor": {
      "type": "system",
      "id": "n8n-workflow-tenant-onboarding"
    }
  }
}
```

### Legacy Format (Backwards Compatible)

```json
{
  "requestId": "req_unique_id_here",
  "tool": "tenant.bootstrap",
  "dryRun": false,
  "args": {
    "businessId": "biz_abc123",
    "name": "Acme Corp"
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool` | string | Yes | Tool name to execute |
| `payload` / `args` | object | Yes | Tool-specific arguments |
| `meta.requestId` / `requestId` | string | Yes | Unique ID for idempotency (use UUID) |
| `meta.dryRun` / `dryRun` | boolean | No | Preview without executing (default: false) |
| `meta.actor` | object | No | Who/what triggered the request |

---

## tenant.bootstrap Tool

### Purpose

The `tenant.bootstrap` tool is an **orchestrator** that executes multiple tools in a single atomic operation. It replaces 3-5 separate n8n workflow nodes with one API call, significantly reducing:

- API call volume and rate limiting issues
- Workflow complexity and maintenance
- Error handling overhead

### What It Orchestrates

> ⚠️ The tools listed below are **internal building blocks**. Do not call them directly.

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `tenant.ensure` ⚠️ | Create or verify the business record exists |
| 2 | `billing.validateStripeConfig` ⚠️ | Check Stripe keys and price configuration |
| 3 | `voice.smokeTest` ⚠️ | Verify AI phone agent endpoints are reachable |
| 4 | `tenant.provisioningSummary` ⚠️ | Get complete provisioning state and score |

### Request Arguments

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `businessId` | string | **Yes** | - | Unique business identifier |
| `name` | string | No | - | Business display name (used if creating new) |
| `skipVoiceTest` | boolean | No | `false` | Skip voice smoke test (faster execution) |
| `skipBillingCheck` | boolean | No | `false` | Skip Stripe validation |

### Request Example

```bash
curl -X POST https://your-domain.com/api/internal/ops/execute \
  -H "Content-Type: application/json" \
  -H "x-book8-internal-secret: your-api-key" \
  -d '{
    "tool": "tenant.bootstrap",
    "payload": {
      "businessId": "biz_abc123",
      "name": "Acme Corp",
      "skipVoiceTest": false,
      "skipBillingCheck": false
    },
    "meta": {
      "requestId": "bootstrap-acme-2025-01-02-001",
      "dryRun": false
    }
  }'
```

### Response Format

```json
{
  "ok": true,
  "requestId": "bootstrap-acme-2025-01-02-001",
  "tool": "tenant.bootstrap",
  "dryRun": false,
  "result": {
    "ok": true,
    "businessId": "biz_abc123",
    "ready": true,
    "readyMessage": "Tenant is fully bootstrapped and ready",
    "checklist": [
      {
        "step": 1,
        "item": "Tenant Record",
        "tool": "tenant.ensure",
        "status": "done",
        "details": "Already exists",
        "durationMs": 2
      },
      {
        "step": 2,
        "item": "Billing Configuration",
        "tool": "billing.validateStripeConfig",
        "status": "warning",
        "details": "Stripe live",
        "durationMs": 208
      },
      {
        "step": 3,
        "item": "Voice Services",
        "tool": "voice.smokeTest",
        "status": "done",
        "details": "4/4 checks passed",
        "durationMs": 190
      },
      {
        "step": 4,
        "item": "Provisioning Status",
        "tool": "tenant.provisioningSummary",
        "status": "in_progress",
        "details": "60% complete",
        "durationMs": 5
      }
    ],
    "recommendations": [
      {
        "priority": "high",
        "item": "subscription",
        "message": "Activate subscription to unlock all features"
      },
      {
        "priority": "medium",
        "item": "calendar",
        "message": "Connect Google Calendar for availability sync"
      }
    ],
    "details": {
      "tenant": {
        "businessId": "biz_abc123",
        "existed": true,
        "created": false
      },
      "billing": {
        "stripeConfigured": true,
        "stripeMode": "live",
        "checks": [...]
      },
      "voice": {
        "passed": 4,
        "total": 4,
        "checks": [...]
      },
      "provisioning": {
        "exists": true,
        "score": 60,
        "subscription": {...},
        "calendar": {...},
        "scheduling": {...}
      }
    },
    "stats": {
      "totalSteps": 4,
      "completed": 2,
      "warnings": 1,
      "skipped": 0,
      "failed": 0
    },
    "durationMs": 405,
    "summary": "Bootstrapped tenant biz_abc123 - Ready (2/4 complete)"
  },
  "executedAt": "2025-01-02T22:36:29.441Z",
  "durationMs": 437,
  "_meta": {
    "version": "v1.3.0",
    "cached": false
  }
}
```

### Checklist Status Values

| Status | Meaning | Blocks Ready? |
|--------|---------|---------------|
| `done` | Step completed successfully | No |
| `warning` | Completed with non-blocking issues | No |
| `in_progress` | Partially complete (e.g., provisioning at 60%) | No |
| `skipped` | Step was skipped by request | No |
| `failed` | Step failed | **Yes** |

### Ready Logic

The `ready` field is `true` when:
- Tenant record exists (step 1 passed)
- No steps have `status: "failed"`
- Provisioning summary found the tenant

**Note:** `warning` and `in_progress` statuses do NOT block readiness.

---

## Dry Run Mode

When `dryRun: true`, the tool describes what it would do without executing:

```json
{
  "tool": "tenant.bootstrap",
  "payload": { "businessId": "biz_abc123" },
  "meta": {
    "requestId": "dry-run-test-001",
    "dryRun": true
  }
}
```

Response includes:
```json
{
  "result": {
    "dryRun": true,
    "summary": "[DRY RUN] Would bootstrap tenant biz_abc123"
  }
}
```

---

## Rate Limiting

### Current Configuration

| Endpoint | Rate Limited? | Limit |
|----------|---------------|-------|
| `GET /api/internal/ops/execute` | **No** | Unlimited for authenticated requests |
| `POST /api/internal/ops/execute` | Yes | Varies by API key type |

### POST Rate Limits by Key Type

| Key Type | Requests/Minute |
|----------|-----------------|
| Admin keys (`OPS_KEY_ADMIN`) | 300 |
| n8n automation keys (`OPS_KEY_N8N`) | 200 |
| Default/legacy keys (`OPS_INTERNAL_SECRET`) | 100 |

### Why `tenant.bootstrap` Helps with Rate Limits

Using `tenant.bootstrap` instead of individual tools dramatically reduces API calls:

| Approach | API Calls per Tenant | 100 Tenants = |
|----------|---------------------|---------------|
| ⚠️ Individual tools (deprecated) | 4 calls | 400 calls |
| ✅ `tenant.bootstrap` | 1 call | 100 calls |

### Handling 429 Responses

When rate limited, the API returns:

```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

**Headers included:**
- `Retry-After: 60`
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: 1704236400`

**n8n Retry Strategy:**
```
Wait: {{ $json.error.retryAfter || 60 }} seconds
Max Retries: 3
```

---

## Authentication

### Header Requirement

All requests must include the `x-book8-internal-secret` header:

```bash
curl -H "x-book8-internal-secret: your-api-key-here" ...
```

### Supported API Keys

Configure these in your environment:

| Environment Variable | Purpose | Scopes |
|---------------------|---------|--------|
| `OPS_KEY_ADMIN` | Full admin access | `*` (all) |
| `OPS_KEY_N8N` | n8n workflow automation | `ops.execute`, `tenant.*`, `voice.*`, `billing.read` |
| `OPS_INTERNAL_SECRET` | Legacy single key | `*` (all) |

### Error Responses

**Missing header:**
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Missing x-book8-internal-secret header"
  }
}
```

**Invalid key:**
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_FAILED", 
    "message": "Invalid API key"
  }
}
```

---

## n8n Integration Examples

### Basic tenant.bootstrap Node

**HTTP Request Node Configuration:**

| Field | Value |
|-------|-------|
| Method | POST |
| URL | `https://your-domain.com/api/internal/ops/execute` |
| Authentication | None (use header below) |
| Headers | `x-book8-internal-secret`: `{{ $env.OPS_API_KEY }}` |
| Body Content Type | JSON |

**Body:**
```json
{
  "tool": "tenant.bootstrap",
  "payload": {
    "businessId": "{{ $json.businessId }}",
    "name": "{{ $json.businessName }}"
  },
  "meta": {
    "requestId": "n8n-{{ $execution.id }}-bootstrap",
    "dryRun": false
  }
}
```

### Workflow Pattern: New Tenant Onboarding

```
[Trigger: New Signup] 
    → [tenant.bootstrap] 
    → [IF ready=true] 
        → [Send Welcome Email]
    → [ELSE] 
        → [Alert: Manual Setup Required]
```

> ⚠️ **Do NOT** create workflows that call individual deprecated tools. Always use `tenant.bootstrap`.

### Processing the Response

**Check if ready:**
```javascript
// In n8n Function node
const result = $json.result;

return [{
  json: {
    ready: result.ready,
    score: result.details?.provisioning?.score || 0,
    recommendations: result.recommendations?.length || 0,
    needsAttention: !result.ready
  }
}];
```

### Fast Bootstrap (Skip Optional Checks)

For faster execution when you only need tenant creation:

```json
{
  "tool": "tenant.bootstrap",
  "payload": {
    "businessId": "{{ $json.businessId }}",
    "skipVoiceTest": true,
    "skipBillingCheck": true
  },
  "meta": {
    "requestId": "n8n-{{ $execution.id }}-fast-bootstrap"
  }
}
```

This reduces execution time from ~400ms to ~15ms.

---

## Idempotency

Each request must include a unique `requestId`. If the same `requestId` is sent twice:

1. First request: Executes normally, result cached for 7 days
2. Subsequent requests: Returns cached result immediately

**Response with cached result:**
```json
{
  "_meta": {
    "cached": true,
    "originalExecutedAt": "2025-01-02T10:00:00.000Z"
  }
}
```

**Best Practice for requestId:**
```
Format: {workflow-name}-{execution-id}-{timestamp}
Example: tenant-onboarding-abc123-1704236400
```

---

## Error Handling

### Error Response Structure

```json
{
  "ok": false,
  "requestId": "...",
  "tool": "tenant.bootstrap",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... },
    "help": "Suggested fix"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Cause |
|------|-------------|-------|
| `AUTH_FAILED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | API key lacks required scope |
| `VALIDATION_ERROR` | 400 | Invalid request format |
| `ARGS_VALIDATION_ERROR` | 400 | Missing or invalid tool arguments |
| `TOOL_NOT_ALLOWED` | 400 | Tool not in allowlist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `REQUEST_IN_PROGRESS` | 409 | Same requestId already processing |
| `BOOTSTRAP_ERROR` | 500 | Error during bootstrap execution |

---

## Health Check

Query available tools and API status:

```bash
curl -X GET https://your-domain.com/api/internal/ops/execute \
  -H "x-book8-internal-secret: your-api-key"
```

**Response:**
```json
{
  "ok": true,
  "version": "v1.3.0",
  "tools": [
    {
      "name": "tenant.bootstrap",
      "requiredScope": "tenant.write",
      "requiredArgs": ["businessId"],
      "accessible": true
    }
  ],
  "health": {
    "status": "ok",
    "timestamp": "2025-01-02T22:36:29.441Z"
  }
}
```

---

## Changelog

### v1.3.0 (Current)
- **Added `tenant.bootstrap` orchestrator tool** - the canonical path for tenant onboarding
- Deprecated direct use of `tenant.ensure`, `billing.validateStripeConfig`, `voice.smokeTest`, `tenant.provisioningSummary`
- Removed rate limiting from GET endpoint for authenticated requests
- Added `skipVoiceTest` and `skipBillingCheck` options
- Enhanced response with `stats` and `recommendations`
- Added Readiness Contract documentation

### v1.2.0
- Added scoped API keys support
- Added `billing.validateStripeConfig` tool ⚠️ (now deprecated for direct use)

### v1.1.0
- Added rate limiting with key-type-based limits
- Added constant-time authentication

### v1.0.0
- Initial release with core tools
- Idempotency and audit logging
