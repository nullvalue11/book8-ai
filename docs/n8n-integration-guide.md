# n8n Integration Guide for Ops Control Plane

## Overview

This guide provides step-by-step instructions for configuring n8n workflows to interact with the Book8-AI Ops Control Plane API.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Workflow Architecture](#workflow-architecture)
3. [Node Configuration](#node-configuration)
4. [Testing & Validation](#testing--validation)
5. [Error Handling](#error-handling)
6. [Production Checklist](#production-checklist)

---

## Prerequisites

Before configuring the n8n workflow, ensure:

- [ ] `OPS_INTERNAL_SECRET` is set in Vercel environment variables
- [ ] The ops endpoint is accessible: `https://ops.book8.io/api/internal/ops/execute`
- [ ] You have valid businessIds to test with

### Available Tools (V1)

| Tool | Description | Required Args |
|------|-------------|---------------|
| `tenant.ensure` | Create/verify business record | `businessId`, optional `name` |
| `billing.validateStripeConfig` | Validate Stripe configuration | `businessId` |
| `voice.smokeTest` | Health check voice services | `businessId` |
| `tenant.provisioningSummary` | Get tenant provisioning state | `businessId` |

---

## Workflow Architecture

### Recommended Flow

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  Ops Input  │───▶│  IF Guard    │───▶│ Execute Tool │───▶│  Response   │
│   (Set)     │    │   Rails      │    │ (HTTP POST)  │    │  Handler    │
└─────────────┘    └──────────────┘    └──────────────┘    └─────────────┘
                          │
                          ▼ (validation failed)
                   ┌──────────────┐
                   │    Error     │
                   │   Handler    │
                   └──────────────┘
```

### Simplified Flow (Minimum Viable)

```
┌─────────────┐    ┌──────────────┐
│  Ops Input  │───▶│ Execute Tool │
│   (Set)     │    │ (HTTP POST)  │
└─────────────┘    └──────────────┘
```

---

## Node Configuration

### 1. Ops Input Node (Set Node)

**Purpose:** Define the operation payload

**Node Type:** `Set`

**Configuration:**

| Field | Type | Value | Expression |
|-------|------|-------|------------|
| `tool` | String | - | `tenant.ensure` |
| `requestId` | String | - | `={{ 'ops-' + $execution.id }}` |
| `dryRun` | Boolean | - | `true` or `false` |
| `input` | JSON | - | See below |

**Input Field (JSON):**
```json
{
  "businessId": "your-business-id-here",
  "name": "Optional Business Name"
}
```

**Complete Output Example:**
```json
{
  "tool": "tenant.ensure",
  "requestId": "ops-abc123-def456",
  "dryRun": true,
  "input": {
    "businessId": "user-uuid-here",
    "name": "Test Coach Business"
  }
}
```

---

### 2. IF Guard Rails Node (Optional but Recommended)

**Purpose:** Validate payload before sending to API

**Node Type:** `IF`

**Conditions (All must be true):**

```
Condition 1: {{ $json.tool }} is not empty
Condition 2: {{ $json.requestId }} is not empty  
Condition 3: {{ $json.input.businessId }} is not empty
```

**Alternative: Code Node Validation**

If you prefer a Code node for validation:

```javascript
// Validate required fields
const errors = [];

if (!$input.first().json.tool) {
  errors.push('tool is required');
}

if (!$input.first().json.requestId) {
  errors.push('requestId is required');
}

if (!$input.first().json.input?.businessId) {
  errors.push('input.businessId is required');
}

if (errors.length > 0) {
  throw new Error(`Validation failed: ${errors.join(', ')}`);
}

// Pass through if valid
return $input.all();
```

---

### 3. Execute Tool Node (HTTP Request)

**Purpose:** Call the Ops Control Plane API

**Node Type:** `HTTP Request`

#### Basic Settings

| Setting | Value |
|---------|-------|
| Method | `POST` |
| URL | `https://ops.book8.io/api/internal/ops/execute` |

#### Body Configuration

| Setting | Value |
|---------|-------|
| Send Body | ✅ Enabled |
| Body Content Type | `JSON` |
| Specify Body | `Using JSON` |
| JSON | `={{ $json }}` |

#### Headers Configuration

| Header Name | Header Value |
|-------------|--------------|
| `x-book8-internal-secret` | `your-secret-here` or `={{ $credentials.opsSecret }}` |
| `content-type` | `application/json` |

#### Options

| Option | Value |
|--------|-------|
| Timeout | `60000` (60 seconds) |
| Response Format | `JSON` |
| Full Response | ✅ Enabled (recommended for debugging) |

#### Complete HTTP Request Settings JSON

```json
{
  "method": "POST",
  "url": "https://ops.book8.io/api/internal/ops/execute",
  "sendBody": true,
  "bodyContentType": "json",
  "jsonBody": "={{ $json }}",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "x-book8-internal-secret",
        "value": "YOUR_SECRET_HERE"
      },
      {
        "name": "content-type", 
        "value": "application/json"
      }
    ]
  },
  "options": {
    "timeout": 60000,
    "response": {
      "fullResponse": true
    }
  }
}
```

---

### 4. Response Handler Node (Optional)

**Purpose:** Process API response and route based on success/failure

**Node Type:** `IF` or `Switch`

**IF Node Conditions:**

```
Condition: {{ $json.body.ok }} equals true
```

**True Branch:** Success handling
**False Branch:** Error handling

---

## Testing & Validation

### Test Payloads

#### Test 1: Dry Run - Tenant Ensure
```json
{
  "tool": "tenant.ensure",
  "requestId": "n8n-test-dry-001",
  "dryRun": true,
  "input": {
    "businessId": "test-business-id"
  }
}
```

**Expected Response:**
```json
{
  "ok": true,
  "requestId": "n8n-test-dry-001",
  "tool": "tenant.ensure",
  "dryRun": true,
  "result": {
    "ok": true,
    "businessId": "test-business-id",
    "existed": false,
    "created": false,
    "dryRunPlan": {
      "action": "create_business",
      "businessId": "test-business-id",
      "fields": ["id", "email", "createdAt", "subscription"]
    },
    "summary": "[DRY RUN] Would create business test-business-id"
  }
}
```

#### Test 2: Live Run - Provisioning Summary
```json
{
  "tool": "tenant.provisioningSummary",
  "requestId": "n8n-test-provision-001",
  "dryRun": false,
  "input": {
    "businessId": "actual-user-uuid"
  }
}
```

#### Test 3: Billing Validation
```json
{
  "tool": "billing.validateStripeConfig",
  "requestId": "n8n-test-billing-001",
  "dryRun": false,
  "input": {
    "businessId": "system-check"
  }
}
```

### Manual cURL Test

Before configuring n8n, verify the endpoint works:

```bash
curl -X POST https://ops.book8.io/api/internal/ops/execute \
  -H "Content-Type: application/json" \
  -H "x-book8-internal-secret: YOUR_SECRET" \
  -d '{
    "tool": "tenant.ensure",
    "requestId": "curl-test-001",
    "dryRun": true,
    "input": {
      "businessId": "test-from-curl"
    }
  }'
```

---

## Error Handling

### Error Response Format

```json
{
  "ok": false,
  "requestId": "...",
  "tool": "...",
  "dryRun": false,
  "result": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning | Resolution |
|------|-------------|---------|------------|
| `AUTH_FAILED` | 401 | Invalid/missing secret | Check `x-book8-internal-secret` header |
| `INVALID_JSON` | 400 | Malformed JSON body | Validate JSON syntax |
| `VALIDATION_ERROR` | 400 | Request schema invalid | Check required fields |
| `TOOL_NOT_ALLOWED` | 400 | Unknown tool name | Use valid tool from allowlist |
| `ARGS_VALIDATION_ERROR` | 400 | Tool args invalid | Check tool-specific required args |
| `REQUEST_IN_PROGRESS` | 409 | Duplicate requestId | Use unique requestId |
| `INTERNAL_ERROR` | 500 | Server error | Check logs, retry |

### n8n Error Handling Node

Add an **IF** node after Execute Tool:

```
Condition: {{ $json.body.ok }} equals false
```

**True (Error) Branch:** 
- Log error to Slack/Discord
- Store in error tracking sheet
- Send alert email

**False (Success) Branch:**
- Continue normal flow

---

## Production Checklist

### Before Going Live

- [ ] Replace test `businessId` with real user IDs
- [ ] Set `dryRun: false` for actual operations
- [ ] Use unique `requestId` per execution (use `$execution.id`)
- [ ] Store `OPS_INTERNAL_SECRET` securely in n8n credentials
- [ ] Set appropriate timeout (60000ms recommended)
- [ ] Add error handling nodes
- [ ] Test with real data in staging first

### Monitoring

- [ ] Check Vercel logs for execution traces
- [ ] Monitor MongoDB `ops_audit_logs` collection
- [ ] Set up alerts for failed executions

### Security

- [ ] Never expose `OPS_INTERNAL_SECRET` in logs
- [ ] Use n8n credentials store for secrets
- [ ] Restrict n8n workflow access to admins only

---

## Troubleshooting

### "ARGS_VALIDATION_ERROR: businessId Required"

**Cause:** Args not in correct location

**Solution:** Ensure businessId is inside `input` object:
```json
{
  "input": {
    "businessId": "..."
  }
}
```

The API also accepts `args` object or flat top-level args.

### "AUTH_FAILED: Missing x-book8-internal-secret header"

**Cause:** Header not being sent

**Solution:** 
1. Check "Send Headers" is enabled
2. Verify header name is exactly `x-book8-internal-secret`
3. Check secret value matches Vercel env var

### Request Timeout

**Cause:** Tool execution taking too long

**Solution:**
1. Increase timeout to 60000ms or higher
2. Check if downstream services are healthy
3. Use `voice.smokeTest` to verify service health

### Idempotency - Same Result Returned

**Cause:** Same `requestId` used multiple times

**Solution:** This is expected behavior! Use unique `requestId` for each execution:
```
requestId: {{ 'ops-' + $execution.id + '-' + Date.now() }}
```

---

## Support

- **API Documentation:** `/docs/ops-control-plane-v1.md`
- **Endpoint Health:** `GET https://ops.book8.io/api/internal/ops/execute` (lists available tools)
- **Audit Logs:** Check MongoDB `ops_audit_logs` collection
