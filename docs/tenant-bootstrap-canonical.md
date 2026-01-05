# tenant.bootstrap - Canonical Tenant Onboarding

> **Rule: "If you want a tenant, you call `tenant.bootstrap`. Period."**

## Overview

`tenant.bootstrap` is the **ONLY** supported method for tenant onboarding in the Book8-AI platform. This single orchestrator tool replaces multiple individual API calls with one atomic operation.

## Quick Start

```bash
curl -X POST https://your-domain.com/api/internal/ops/execute \
  -H "Content-Type: application/json" \
  -H "x-book8-internal-secret: your-api-key" \
  -d '{
    "tool": "tenant.bootstrap",
    "payload": { "businessId": "biz_abc123" },
    "meta": { "requestId": "unique-request-id" }
  }'
```

## Response

```json
{
  "ok": true,
  "result": {
    "ready": true,
    "readyMessage": "Tenant is fully bootstrapped and ready",
    "checklist": [
      { "step": 1, "item": "Tenant Record", "status": "done" },
      { "step": 2, "item": "Billing Configuration", "status": "done" },
      { "step": 3, "item": "Voice Services", "status": "done" },
      { "step": 4, "item": "Provisioning Status", "status": "done" }
    ],
    "recommendations": [],
    "stats": { "totalSteps": 4, "completed": 4, "warnings": 0, "skipped": 0, "failed": 0 }
  }
}
```

---

## ⚠️ DEPRECATED: Direct Tool Calls

**DO NOT** call these tools directly in workflows:

| Deprecated Tool | Status | Migration |
|-----------------|--------|-----------|
| `tenant.ensure` | ⚠️ DEPRECATED | Use `tenant.bootstrap` |
| `billing.validateStripeConfig` | ⚠️ DEPRECATED | Use `tenant.bootstrap` |
| `voice.smokeTest` | ⚠️ DEPRECATED | Use `tenant.bootstrap` |
| `tenant.provisioningSummary` | ⚠️ DEPRECATED | Use `tenant.bootstrap` |

### Why Direct Calls Are Deprecated

1. **Rate Limiting**: 4 separate calls = 4x rate limit consumption
2. **No Atomicity**: Partial failures leave tenant in inconsistent state
3. **No Consolidated Status**: Must aggregate results manually
4. **Complex Error Handling**: 4 different error handlers needed
5. **Maintenance Burden**: Changes require updating multiple workflow nodes

### Migration Example

❌ **Before (Deprecated):**
```
n8n Workflow:
[tenant.ensure] → [billing.validateStripeConfig] → [voice.smokeTest] → [tenant.provisioningSummary]
     ↓                    ↓                              ↓                        ↓
  Handle error      Handle error                   Handle error              Handle error
     ↓                    ↓                              ↓                        ↓
  4 API calls, 4 HTTP nodes, complex branching logic
```

✅ **After (Required):**
```
n8n Workflow:
[tenant.bootstrap] → [Check ready field] → [Continue or Alert]
     ↓
  1 API call, 1 HTTP node, simple branching
```

---

## Readiness Contract

### The `ready` Field

The `ready` boolean is the **single source of truth** for tenant status:

| Value | Meaning | Action |
|-------|---------|--------|
| `ready: true` | Tenant is fully bootstrapped and operational | Proceed with onboarding flow |
| `ready: false` | Tenant requires attention | Check `checklist` for failures, review `recommendations` |

### What `ready: true` Guarantees

When `ready: true`, you have these guarantees:

- ✅ **Tenant Record Exists**: Business is in the database
- ✅ **No Critical Failures**: All steps completed without `status: "failed"`
- ✅ **Operational**: Tenant can receive bookings and use features
- ✅ **Queryable**: Tenant data is available for API queries

### What `ready: false` Means

When `ready: false`, the tenant needs attention:

1. **Check `checklist`**: Find steps with `status: "failed"`
2. **Review `recommendations`**: Prioritized list of actions needed
3. **Examine `details`**: Full diagnostic data for each subsystem

### Checklist Status Values

| Status | Meaning | Blocks Ready? |
|--------|---------|---------------|
| `done` | Step completed successfully | No |
| `warning` | Completed with non-blocking issues | No |
| `in_progress` | Partially complete | No |
| `skipped` | Skipped by request | No |
| `failed` | Step failed | **Yes** |

---

## Use Cases

### 1. UI Onboarding Flow

```javascript
const response = await bootstrap(businessId);

if (response.result.ready) {
  // Show success screen
  showWelcomeScreen();
} else {
  // Show setup wizard with remaining steps
  showSetupWizard(response.result.checklist);
}
```

### 2. Dashboard Status

```javascript
const { stats, recommendations } = response.result;

// Progress bar
const progress = (stats.completed / stats.totalSteps) * 100;

// Action items
const urgentItems = recommendations.filter(r => r.priority === 'high');
```

### 3. Automated Follow-ups

```javascript
// n8n workflow
if (!response.result.ready) {
  // Schedule retry
  scheduleRetry(businessId, { delay: '1h' });
  
  // Alert if critical
  if (response.result.checklist.some(c => c.status === 'failed')) {
    alertOpsTeam(businessId, response.result);
  }
}
```

### 4. Debugging

```javascript
// Find failing step
const failedStep = response.result.checklist.find(c => c.status === 'failed');
console.log(`Step ${failedStep.step} failed: ${failedStep.item}`);
console.log(`Details: ${failedStep.details}`);

// Check raw metadata for full diagnostics
console.log(response.result.details);
```

---

## Request Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `businessId` | string | **Yes** | Unique business identifier |
| `name` | string | No | Business display name |
| `skipVoiceTest` | boolean | No | Skip voice smoke test (faster) |
| `skipBillingCheck` | boolean | No | Skip Stripe validation |

### Fast Bootstrap (Skip Optional Checks)

```json
{
  "tool": "tenant.bootstrap",
  "payload": {
    "businessId": "biz_abc123",
    "skipVoiceTest": true,
    "skipBillingCheck": true
  },
  "meta": { "requestId": "..." }
}
```

Execution time: ~15ms vs ~400ms with all checks.

---

## Full Documentation

For complete API documentation including:
- Request/response formats
- Authentication
- Rate limiting
- n8n integration examples
- Error handling

See: [/docs/ops-control-plane-payload.md](./ops-control-plane-payload.md)

---

## Summary

| Aspect | Value |
|--------|-------|
| **Canonical Tool** | `tenant.bootstrap` |
| **Deprecated Tools** | `tenant.ensure`, `billing.validateStripeConfig`, `voice.smokeTest`, `tenant.provisioningSummary` |
| **Key Response Field** | `ready: true/false` |
| **API Calls Saved** | 3 per tenant (4 → 1) |
| **Rule** | "If you want a tenant, you call `tenant.bootstrap`. Period." |
