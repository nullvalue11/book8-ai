# E2E Golden Workflow Checklist

## Overview
This document provides a step-by-step checklist for testing the complete Business Registration "Golden Workflow" in Book8.

## Prerequisites

### 1. Environment Variables (Vercel)
Verify these are set in **Vercel → Project book8-ai → Settings → Environment Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `N8N_BUSINESS_PROVISIONED_WEBHOOK_URL` | n8n webhook for business provisioned events | `https://n8n.book8.io/webhook/business-provisioned` |
| `OPS_INTERNAL_BASE_URL` | Base URL for ops API calls | `https://ops.book8.io` |
| `OPS_INTERNAL_SECRET` | Secret for ops API authentication | (your secret) |
| `STRIPE_SECRET_KEY` | Stripe API key (use test mode for testing) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | (from Google Cloud Console) |

**Important:** After adding/updating env vars, redeploy the latest commit for changes to take effect.

---

## Test Steps

### Step A: Business Registration & Provisioning
**WHERE:** https://book8.io/dashboard/business

1. [ ] Navigate to `/dashboard/business`
2. [ ] Click "Start Registration"
3. [ ] Enter business name (e.g., "Test Business")
4. [ ] (Optional) Toggle "Skip Voice Test" and "Skip Billing Check" for faster testing
5. [ ] Click "Plan Setup"

**Expected Result - Plan Mode:**
- [ ] See a "Review Provisioning Plan" screen
- [ ] Plan shows 4 steps (tenant.ensure, billing, voice, provisioning summary)
- [ ] Business ID is displayed (copy this for later)

6. [ ] Click "Confirm & Provision"

**Expected Result - Execute Mode:**
- [ ] Loading state shows "Provisioning your business..."
- [ ] Success message appears with "Business Provisioned!"
- [ ] Status changes to `ready` (or `needs_attention` with checklist)
- [ ] Note the `requestId` if shown

**Record these values:**
- `businessId`: _______________
- `opsRequestId`: _______________

---

### Step B: Verify Ops Execution Logs
**WHERE:** https://book8.io/ops/logs

1. [ ] Navigate to `/ops/logs`
2. [ ] Filter by:
   - Tool: `tenant.bootstrap`
   - (Optional) Business ID from Step A
3. [ ] Find the execution entry

**Expected Result:**
- [ ] Entry shows `status: success` or `status: partial`
- [ ] `durationMs` is reasonable (typically < 2000ms)
- [ ] Request ID matches the one from Step A

---

### Step C: Verify n8n Webhook Fired
**WHERE:** https://n8n.book8.io (your n8n instance)

1. [ ] Go to the webhook workflow in n8n
2. [ ] Check executions list

**Expected Result:**
- [ ] Execution triggered at the time you clicked "Confirm & Provision"
- [ ] Webhook payload contains:
  - `event: 'business.provisioned'`
  - `business.businessId` matching your business
  - `opsRequestId` matching the execution

**Troubleshooting if webhook didn't fire:**
- Check Vercel env var `N8N_BUSINESS_PROVISIONED_WEBHOOK_URL`
- Check Vercel deployment logs for `[business/confirm] Webhook config check`
- Verify n8n webhook URL is correct and accessible

---

### Step D: Stripe Subscription (Test Mode)
**WHERE:** https://book8.io/dashboard/business

1. [ ] On the business page, find your business
2. [ ] Click "Subscribe" button
3. [ ] Complete Stripe test checkout:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. [ ] Return to dashboard

**Expected Result:**
- [ ] Redirect back to `/dashboard/business?checkout=success`
- [ ] Business shows "Subscription: active"
- [ ] Green checkmark appears next to subscription status

---

### Step E: Google Calendar Connect
**WHERE:** https://book8.io/dashboard/business

**Prerequisite:** Business must have active subscription first

1. [ ] Find your business on the dashboard
2. [ ] Click "Connect" button in the Calendar section
3. [ ] Complete Google OAuth flow
4. [ ] Return to dashboard

**Expected Result:**
- [ ] Redirect back to `/dashboard/business?google_connected=1`
- [ ] Calendar shows "Connected"
- [ ] Green checkmark appears next to calendar status
- [ ] Agent status should now show "Ready"

---

## Debugging

### Check Vercel Logs
**WHERE:** Vercel → Project → Deployments → (latest) → Logs

Search for these log prefixes:
- `[business/confirm]` - Business provisioning logs
- `[ops/logs proxy]` - Rate limit header forwarding
- `[opsFetch]` - Internal API calls

### Common Issues

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| "auth_required" error | JWT token invalid/expired | Re-login to the app |
| Webhook not firing | `N8N_BUSINESS_PROVISIONED_WEBHOOK_URL` not set | Add env var and redeploy |
| Rate Limit panel shows "unavailable" | Internal API not returning headers | Check `OPS_INTERNAL_SECRET` |
| Stripe checkout fails | Test keys not configured | Check `STRIPE_SECRET_KEY` |
| Google OAuth fails | OAuth credentials misconfigured | Check Google Cloud Console settings |

---

## Quick Validation Commands

### Test business registration API directly:
```bash
# Register
curl -X POST https://book8.io/api/business/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Business", "skipVoiceTest": true, "skipBillingCheck": true}'

# List businesses
curl -X GET https://book8.io/api/business/register \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test ops logs proxy:
```bash
curl -X GET https://book8.io/api/ops/logs?limit=5 \
  -H "Cookie: YOUR_BASIC_AUTH_COOKIE" \
  -v  # Check for X-RateLimit-* headers
```

---

## Success Criteria

A complete Golden Workflow test is successful when:

1. [ ] Business created with status `pending`
2. [ ] Provisioning plan shown with 4 steps
3. [ ] Business provisioned to status `ready`
4. [ ] Ops execution logged in `/ops/logs`
5. [ ] n8n webhook triggered (if configured)
6. [ ] Stripe subscription shows `active`
7. [ ] Google Calendar shows `Connected`
8. [ ] Agent status shows `Ready`

---

*Last updated: January 2025*
