# Ops Control Plane V1

## Overview

The Ops Control Plane provides a secure, internal-only API endpoint for executing predefined operational tasks (tools) in a structured, auditable, and idempotent manner.

**Version:** v1.1.0

---

## Table of Contents

1. [Endpoint](#endpoint)
2. [Authentication](#authentication)
3. [Request Formats](#request-formats)
4. [Response Format](#response-format)
5. [Available Tools](#available-tools)
6. [Error Handling](#error-handling)
7. [Idempotency](#idempotency)
8. [Audit Logging](#audit-logging)
9. [n8n Integration](#n8n-integration)
10. [Examples](#examples)

---

## Endpoint

```
POST /api/internal/ops/execute  - Execute a tool
GET  /api/internal/ops/execute  - List available tools & health check
```

**Production URL:** `https://ops.book8.io/api/internal/ops/execute`

---

## Authentication

All requests must include the `x-book8-internal-secret` header with a value matching the `OPS_INTERNAL_SECRET` environment variable.

```bash
curl -X POST https://ops.book8.io/api/internal/ops/execute \
  -H "Content-Type: application/json" \
  -H "x-book8-internal-secret: YOUR_SECRET_HERE" \
  -d '{ ... }'
```

If `OPS_INTERNAL_SECRET` is not set, the endpoint falls back to `ADMIN_TOKEN`.

---

## Request Formats

The API supports **three request formats** for flexibility with different clients (n8n, scripts, etc.):

### Format 1: Nested `args` Object (Recommended)

```json
{
  "requestId": "unique-request-id-123",
  "tool": "tenant.ensure",
  "dryRun": false,
  "args": {
    "businessId": "user-uuid-here",
    "name": "Business Name"
  },
  "actor": {
    "type": "system",
    "id": "my-script"
  }
}
```

### Format 2: Nested `input` Object (n8n Style)

```json
{
  "requestId": "unique-request-id-123",
  "tool": "tenant.ensure",
  "dryRun": false,
  "input": {
    "businessId": "user-uuid-here",
    "name": "Business Name"
  }
}
```

### Format 3: Flat Top-Level Args

```json
{
  "requestId": "unique-request-id-123",
  "tool": "tenant.ensure",
  "dryRun": false,
  "businessId": "user-uuid-here",
  "name": "Business Name"
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `requestId` | string | Yes | Unique identifier for idempotency |
| `tool` | string | Yes | Tool name from the allowlist |
| `dryRun` | boolean | No (default: false) | If true, describes plan without executing |
| `args` / `input` | object | Depends on tool | Tool-specific arguments |
| `actor.type` | string | No | Either "system" or "user" |
| `actor.id` | string | No | Identifier for the actor |

## Response Format

### Success Response

```json
{
  "ok": true,
  "requestId": "unique-request-id-123",
  "tool": "tenant.ensure",
  "dryRun": false,
  "result": {
    "ok": true,
    "businessId": "user-uuid-here",
    "existed": false,
    "created": true,
    "summary": "Created business user-uuid-here"
  },
  "error": null,
  "executedAt": "2025-06-13T10:30:00.000Z",
  "durationMs": 45
}
```

### Error Response

```json
{
  "ok": false,
  "requestId": "unique-request-id-123",
  "tool": "unknown-tool",
  "dryRun": false,
  "result": null,
  "error": {
    "code": "TOOL_NOT_ALLOWED",
    "message": "Tool 'unknown-tool' is not in the allowlist",
    "details": {
      "availableTools": ["tenant.ensure", "billing.validateStripeConfig", "voice.smokeTest", "tenant.provisioningSummary"]
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_FAILED` | 401 | Missing or invalid secret |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `VALIDATION_ERROR` | 400 | Request schema validation failed |
| `TOOL_NOT_ALLOWED` | 400 | Tool not in allowlist |
| `ARGS_VALIDATION_ERROR` | 400 | Tool arguments failed schema validation |
| `REQUEST_IN_PROGRESS` | 409 | Duplicate requestId already being processed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Idempotency

Every request must include a unique `requestId`. If a request with the same `requestId` is received:

1. If the previous execution completed, the cached result is returned immediately
2. If execution is still in progress, a `REQUEST_IN_PROGRESS` error is returned

Results are cached for 7 days.

## Dry Run Mode

Setting `dryRun: true` causes tools to describe their planned actions without executing them:

```json
{
  "requestId": "dry-run-test-1",
  "dryRun": true,
  "tool": "tenant.ensure",
  "args": { "businessId": "new-user-123" }
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "ok": true,
    "businessId": "new-user-123",
    "existed": false,
    "created": false,
    "dryRunPlan": {
      "action": "create_business",
      "businessId": "new-user-123",
      "fields": ["id", "email", "createdAt", "subscription"]
    },
    "summary": "[DRY RUN] Would create business new-user-123"
  }
}
```

## Audit Logging

Every request creates an audit log entry in the `ops_audit_logs` MongoDB collection:

```json
{
  "requestId": "unique-request-id-123",
  "tool": "tenant.ensure",
  "args": { "businessId": "user-uuid" },
  "actor": { "type": "system", "id": "ops-script" },
  "dryRun": false,
  "status": "succeeded",
  "result": { "ok": true, "summary": "Created business" },
  "error": null,
  "startedAt": "2025-06-13T10:30:00.000Z",
  "completedAt": "2025-06-13T10:30:00.045Z",
  "durationMs": 45,
  "createdAt": "2025-06-13T10:30:00.045Z"
}
```

**Sensitive data is automatically redacted** in audit logs. Fields containing keys like `apiKey`, `secret`, `token`, `password`, etc. are replaced with `[REDACTED:Xchars]`.

---

## V1 Tools

### 1. `tenant.ensure`

Ensures a tenant/business record exists. Creates a minimal record if not present.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `businessId` | string | Yes | User/business ID to ensure |

**Example:**

```json
{
  "requestId": "tenant-ensure-001",
  "tool": "tenant.ensure",
  "args": {
    "businessId": "user-abc-123"
  }
}
```

**Response:**

```json
{
  "ok": true,
  "businessId": "user-abc-123",
  "existed": true,
  "created": false,
  "summary": "Business user-abc-123 already exists"
}
```

---

### 2. `billing.validateStripeConfig`

Validates Stripe environment configuration and price IDs.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `businessId` | string | Yes | Business ID for context |

**Example:**

```json
{
  "requestId": "billing-validate-001",
  "tool": "billing.validateStripeConfig",
  "args": {
    "businessId": "user-abc-123"
  }
}
```

**Response:**

```json
{
  "ok": true,
  "businessId": "user-abc-123",
  "stripeConfigured": true,
  "stripeMode": "test",
  "checks": [
    { "name": "stripe_secret_key", "ok": true, "message": "Secret key configured" },
    { "name": "stripe_publishable_key", "ok": true, "message": "Publishable key configured" },
    { "name": "stripe_webhook_secret", "ok": true, "message": "Webhook secret configured" },
    { "name": "stripe_mode", "ok": true, "message": "Stripe mode: test" },
    { "name": "price_starter", "ok": true, "message": "starter price valid and active" },
    { "name": "price_growth", "ok": true, "message": "growth price valid and active" },
    { "name": "price_enterprise", "ok": true, "message": "enterprise price valid and active" },
    { "name": "price_callMinuteMetered", "ok": true, "message": "callMinuteMetered price valid and active" }
  ],
  "issues": null,
  "allPricesValid": true,
  "summary": "Stripe configuration valid"
}
```

---

### 3. `voice.smokeTest`

Performs lightweight health checks on services required for voice features.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `businessId` | string | Yes | Business ID for context |

**Example:**

```json
{
  "requestId": "voice-smoke-001",
  "tool": "voice.smokeTest",
  "args": {
    "businessId": "user-abc-123"
  }
}
```

**Response:**

```json
{
  "ok": true,
  "businessId": "user-abc-123",
  "checks": [
    { "name": "core_api_health", "ok": true, "status": 200, "latencyMs": 12 },
    { "name": "agent_availability_endpoint", "ok": true, "status": 401, "latencyMs": 15, "details": "Endpoint reachable (auth required)" },
    { "name": "agent_book_endpoint", "ok": true, "status": 401, "latencyMs": 18, "details": "Endpoint reachable (auth required)" },
    { "name": "billing_usage_endpoint", "ok": true, "status": 405, "latencyMs": 14, "details": "Endpoint reachable (auth required)" }
  ],
  "passed": 4,
  "total": 4,
  "summary": "4/4 checks passed"
}
```

---

### 4. `tenant.provisioningSummary`

Returns a comprehensive read-only summary of a tenant's provisioning state.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `businessId` | string | Yes | Business/user ID to check |

**Example:**

```json
{
  "requestId": "provisioning-summary-001",
  "tool": "tenant.provisioningSummary",
  "args": {
    "businessId": "user-abc-123"
  }
}
```

**Response:**

```json
{
  "ok": true,
  "businessId": "user-abc-123",
  "exists": true,
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "subscription": {
    "active": true,
    "status": "active",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "stripeCallMinutesItemId": "si_xxx",
    "stripePriceId": "price_xxx",
    "currentPeriodEnd": "2025-07-15T10:00:00.000Z"
  },
  "calendar": {
    "connected": true,
    "selectedCalendarCount": 2
  },
  "scheduling": {
    "handle": "johndoe",
    "hasAvailability": true
  },
  "voice": {
    "configured": true,
    "agentCount": 1
  },
  "eventTypes": {
    "count": 3
  },
  "checklist": [
    { "item": "subscription_active", "ok": true, "details": "active" },
    { "item": "stripe_customer_id", "ok": true, "details": "present" },
    { "item": "stripe_subscription_id", "ok": true, "details": "present" },
    { "item": "stripe_call_minutes_item", "ok": true, "details": "present" },
    { "item": "calendar_connected", "ok": true, "details": "2 calendars selected" },
    { "item": "scheduling_handle", "ok": true, "details": "johndoe" },
    { "item": "availability_configured", "ok": true, "details": "configured" },
    { "item": "voice_agents", "ok": true, "details": "1 agent(s)" },
    { "item": "event_types", "ok": true, "details": "3 event type(s)" }
  ],
  "provisioningScore": 100,
  "summary": "Provisioning 100% complete (9/9 items)"
}
```

---

## MongoDB Collections

The Ops Control Plane uses three MongoDB collections:

### `ops_audit_logs`

Stores audit logs for all operations.

**Indexes:**
- `requestId` (unique)
- `tool`, `createdAt` (compound, descending)
- `actor.id`, `createdAt` (compound, descending)
- `status`, `createdAt` (compound, descending)

### `ops_executions`

Stores execution results for idempotency.

**Indexes:**
- `requestId` (unique)
- `expiresAt` (TTL: auto-delete after 7 days)

### `ops_locks`

Prevents concurrent execution of the same requestId.

**Indexes:**
- `requestId` (unique)
- `createdAt` (TTL: 5 minutes)

---

## Security Considerations

1. **Authentication**: The endpoint requires a shared secret header. Use a strong, randomly generated value.

2. **Internal Only**: This endpoint should only be accessible from internal services or trusted networks.

3. **Audit Trail**: All operations are logged with actor information and timestamps.

4. **Redaction**: Sensitive data in arguments is automatically redacted in audit logs.

5. **Tool Allowlist**: Only registered tools can be executed. There is no dynamic tool loading.

---

## Usage Examples

### Bash Script

```bash
#!/bin/bash

OPS_SECRET="your-secret"
BASE_URL="https://your-domain.com"

# List available tools
curl -s -X GET "$BASE_URL/api/internal/ops/execute" \
  -H "x-book8-internal-secret: $OPS_SECRET" | jq

# Execute tenant.ensure
curl -s -X POST "$BASE_URL/api/internal/ops/execute" \
  -H "Content-Type: application/json" \
  -H "x-book8-internal-secret: $OPS_SECRET" \
  -d '{
    "requestId": "'"$(uuidgen)"'",
    "tool": "tenant.ensure",
    "args": { "businessId": "user-123" }
  }' | jq
```

### Node.js

```javascript
async function executeOpsTool(tool, args, dryRun = false) {
  const response = await fetch(`${process.env.BASE_URL}/api/internal/ops/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-internal-secret': process.env.OPS_INTERNAL_SECRET
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      tool,
      args,
      dryRun,
      actor: { type: 'system', id: 'my-script' }
    })
  });
  
  return response.json();
}

// Example usage
const result = await executeOpsTool('tenant.provisioningSummary', { 
  businessId: 'user-123' 
});
console.log(result);
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V1 | 2025-06-13 | Initial release with 4 tools |
