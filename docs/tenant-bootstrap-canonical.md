# 🚨 CANONICAL TENANT ONBOARDING: tenant.bootstrap

---

## ⛔ STOP: READ THIS FIRST

> ### **"If you want a tenant, you call `tenant.bootstrap`. Period."**

This is the **ONLY** supported method for tenant onboarding. There are no exceptions.

---

## 🔴 CRITICAL: Deprecated Direct Tool Calls

**The following tools are DEPRECATED for direct workflow/API use:**

| ❌ DEPRECATED Tool | Status | Required Action |
|-------------------|--------|-----------------|
| `tenant.ensure` | 🔴 **DO NOT USE** | Migrate to `tenant.bootstrap` |
| `billing.validateStripeConfig` | 🔴 **DO NOT USE** | Migrate to `tenant.bootstrap` |
| `voice.smokeTest` | 🔴 **DO NOT USE** | Migrate to `tenant.bootstrap` |
| `tenant.provisioningSummary` | 🔴 **DO NOT USE** | Migrate to `tenant.bootstrap` |

### Why These Are Deprecated

| Problem | Impact |
|---------|--------|
| **Rate Limiting** | 4 separate calls consume 4x your rate limit quota |
| **No Atomicity** | Partial failures leave tenants in broken states |
| **No Readiness Signal** | Must manually aggregate results to determine status |
| **Complex Error Handling** | Requires 4 different error handlers |
| **Maintenance Nightmare** | Changes require updating multiple workflow nodes |

### If You Are Currently Using Direct Tool Calls

**You MUST migrate to `tenant.bootstrap` immediately.**

See [Migration Guide](#migration-guide) below.

---

## ✅ The Canonical Path: tenant.bootstrap

`tenant.bootstrap` is a single orchestrator that:

1. ✅ Creates/verifies the tenant record (`tenant.ensure`)
2. ✅ Validates billing configuration (`billing.validateStripeConfig`)
3. ✅ Tests voice services (`voice.smokeTest`)
4. ✅ Gets provisioning summary (`tenant.provisioningSummary`)

**All in ONE atomic API call.**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                      tenant.bootstrap                           │
│                                                                 │
│   ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────┐│
│   │  tenant    │ → │  billing   │ → │   voice    │ → │ summary││
│   │  .ensure   │   │  .validate │   │  .smoke    │   │        ││
│   └────────────┘   └────────────┘   └────────────┘   └────────┘│
│                                                                 │
│   ONE call. ONE response. COMPLETE visibility.                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Start

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

---

## 📋 THE READINESS CONTRACT

Every `tenant.bootstrap` call returns a **guaranteed contract** you can depend on.

### Core Response Structure

```json
{
  "ok": true,
  "result": {
    "ready": true,                    // ← THE KEY FIELD
    "readyMessage": "Tenant is fully bootstrapped and ready",
    "checklist": [...],               // Step-by-step breakdown
    "recommendations": [...],         // Actionable next steps
    "stats": { ... }                  // Aggregate counts
  }
}
```

### The `ready` Field: Your Single Source of Truth

| Value | Operational Meaning | What To Do |
|-------|---------------------|------------|
| `ready: true` | **Tenant is FULLY OPERATIONAL** | ✅ Proceed with onboarding flow |
| `ready: false` | **Tenant REQUIRES ATTENTION** | ⚠️ Check checklist, review recommendations |

---

## ✅ What `ready: true` GUARANTEES

When you receive `ready: true`, you have these **iron-clad guarantees**:

| Guarantee | Description |
|-----------|-------------|
| ✅ **Tenant Exists** | Business record is persisted in the database |
| ✅ **No Critical Failures** | All steps completed without `status: "failed"` |
| ✅ **Fully Operational** | Tenant can receive bookings, use AI features, process payments |
| ✅ **API Ready** | Tenant data is queryable via all Book8 APIs |

### Code Pattern for `ready: true`

```javascript
// n8n or application code
const response = await callTenantBootstrap(businessId);

if (response.result.ready === true) {
  // ✅ SAFE TO PROCEED
  await sendWelcomeEmail(businessId);
  await enableFeatureFlags(businessId);
  await startOnboardingSequence(businessId);
}
```

---

## ⚠️ What `ready: false` MEANS OPERATIONALLY

When you receive `ready: false`, the tenant **is NOT ready for production use**.

### Possible Causes

| Cause | How to Identify | Action |
|-------|-----------------|--------|
| **Step Failed** | `checklist` has item with `status: "failed"` | Fix the underlying issue, retry |
| **Provisioning Incomplete** | `stats.completed < stats.totalSteps` | Wait and retry, or investigate |
| **Warnings Present** | `recommendations` array has `priority: "high"` items | Address high-priority items |

### Code Pattern for `ready: false`

```javascript
const response = await callTenantBootstrap(businessId);

if (response.result.ready === false) {
  // ⚠️ TENANT NEEDS ATTENTION
  
  // 1. Find failed steps
  const failedSteps = response.result.checklist.filter(c => c.status === 'failed');
  
  // 2. Check high-priority recommendations
  const urgentActions = response.result.recommendations.filter(r => r.priority === 'high');
  
  // 3. Decide: retry, alert, or manual intervention
  if (failedSteps.length > 0) {
    await alertOpsTeam({ businessId, failures: failedSteps });
  } else {
    await scheduleRetry({ businessId, delay: '1h' });
  }
}
```

---

## 📊 Understanding the Checklist

The `checklist` array provides step-by-step visibility:

```json
{
  "checklist": [
    { "step": 1, "item": "Tenant Record", "tool": "tenant.ensure", "status": "done", "details": "Created", "durationMs": 5 },
    { "step": 2, "item": "Billing Configuration", "tool": "billing.validateStripeConfig", "status": "warning", "details": "Stripe not configured", "durationMs": 12 },
    { "step": 3, "item": "Voice Services", "tool": "voice.smokeTest", "status": "done", "details": "4/4 checks passed", "durationMs": 203 },
    { "step": 4, "item": "Provisioning Status", "tool": "tenant.provisioningSummary", "status": "in_progress", "details": "60% complete", "durationMs": 8 }
  ]
}
```

### Checklist Status Values

| Status | Meaning | Blocks `ready`? |
|--------|---------|-----------------|
| `done` | ✅ Step completed successfully | No |
| `warning` | ⚠️ Completed with non-blocking issues | No |
| `in_progress` | 🔄 Partially complete (e.g., 60% provisioned) | No |
| `skipped` | ⏭️ Skipped by request (`skipVoiceTest`, etc.) | No |
| `failed` | ❌ Step failed critically | **YES** |

### Finding Problems

```javascript
// Find the failing step
const failedStep = checklist.find(c => c.status === 'failed');
if (failedStep) {
  console.error(`FAILURE at step ${failedStep.step}: ${failedStep.item}`);
  console.error(`Details: ${failedStep.details}`);
  console.error(`Tool: ${failedStep.tool}`);
}

// Get all warnings
const warnings = checklist.filter(c => c.status === 'warning');
warnings.forEach(w => console.warn(`Warning: ${w.item} - ${w.details}`));
```

---

## 🔄 MIGRATION GUIDE

### If You're Using Direct Tool Calls

**Step 1: Identify your current workflow**

```
❌ OLD (DEPRECATED):
[HTTP: tenant.ensure] → [HTTP: billing.validateStripeConfig] → [HTTP: voice.smokeTest] → [HTTP: tenant.provisioningSummary]
```

**Step 2: Replace with single tenant.bootstrap call**

```
✅ NEW (REQUIRED):
[HTTP: tenant.bootstrap] → [IF: ready === true] → [Continue]
                                    ↓
                              [ELSE: Handle not-ready]
```

**Step 3: Update your request body**

```json
// ❌ OLD: Multiple separate calls
// Call 1: POST /api/internal/ops/execute
{ "tool": "tenant.ensure", "requestId": "...", "args": { "businessId": "..." } }
// Call 2: POST /api/internal/ops/execute  
{ "tool": "billing.validateStripeConfig", "requestId": "...", "args": { "businessId": "..." } }
// ... etc

// ✅ NEW: Single call
{
  "tool": "tenant.bootstrap",
  "payload": { "businessId": "biz_abc123" },
  "meta": { "requestId": "unique-id" }
}
```

**Step 4: Update your response handling**

```javascript
// ❌ OLD: Aggregate multiple responses
const ensureOk = response1.ok;
const billingOk = response2.result.stripeConfigured;
const voiceOk = response3.result.passed === response3.result.total;
const ready = ensureOk && billingOk && voiceOk; // Manual aggregation!

// ✅ NEW: Single ready check
const ready = response.result.ready; // That's it!
```

---

## 🎯 Use Cases

### 1. UI Onboarding Flow

```javascript
const { result } = await bootstrap(businessId);

if (result.ready) {
  showWelcomeScreen();
  redirectToDashboard();
} else {
  // Show setup wizard with checklist
  showSetupWizard({
    steps: result.checklist,
    progress: (result.stats.completed / result.stats.totalSteps) * 100
  });
}
```

### 2. Monitoring Dashboard

```javascript
const { result } = await bootstrap(businessId);

// Progress indicator
const progressPercent = (result.stats.completed / result.stats.totalSteps) * 100;

// Action items count
const actionItemsCount = result.recommendations.filter(r => r.priority === 'high').length;

// Status badge
const statusBadge = result.ready ? '🟢 Ready' : '🟡 Setup Required';
```

### 3. Automated n8n Workflow

```
[Webhook: New Signup]
    ↓
[HTTP: tenant.bootstrap]
    ↓
[IF: result.ready === true]
    ├── YES → [Send Welcome Email] → [Enable Features] → [End]
    └── NO  → [Schedule Retry (1hr)] → [Alert if failed steps] → [End]
```

### 4. Debugging

```javascript
// Full diagnostic dump
console.log('=== TENANT BOOTSTRAP DIAGNOSTICS ===');
console.log('Ready:', result.ready);
console.log('Message:', result.readyMessage);
console.log('Stats:', JSON.stringify(result.stats, null, 2));
console.log('Checklist:');
result.checklist.forEach(c => {
  const icon = c.status === 'done' ? '✅' : c.status === 'failed' ? '❌' : '⚠️';
  console.log(`  ${icon} Step ${c.step}: ${c.item} - ${c.status} (${c.details})`);
});
console.log('Recommendations:', result.recommendations);
```

---

## ⚡ Performance Options

### Fast Bootstrap (Skip Optional Checks)

For faster execution when you only need the tenant created:

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

| Mode | Execution Time | Checks Run |
|------|----------------|------------|
| Full bootstrap | ~400ms | All 4 steps |
| Fast bootstrap | ~15ms | Only tenant + provisioning |

---

## 📚 Full API Documentation

For complete API reference including:
- All request/response formats
- Authentication details
- Rate limiting
- Error codes
- n8n integration examples

**See:** [/docs/ops-control-plane-payload.md](./ops-control-plane-payload.md)

---

## 📋 Summary

| Aspect | Value |
|--------|-------|
| **Canonical Tool** | `tenant.bootstrap` |
| **Deprecated Tools** | `tenant.ensure`, `billing.validateStripeConfig`, `voice.smokeTest`, `tenant.provisioningSummary` |
| **Key Response Field** | `ready: true/false` |
| **API Calls Saved** | 3 per tenant (4 → 1) |
| **The Rule** | **"If you want a tenant, you call `tenant.bootstrap`. Period."** |
