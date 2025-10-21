# Phase C - End-to-End Validation Guide

## Overview

This guide provides step-by-step instructions for validating all Phase C features (C.A, C.B, C.C) in production or preview environments.

---

## Prerequisites

**Required**:
- Deployed application (preview or production)
- User account with at least one configured scheduling handle
- Access to MongoDB (for manual verification)
- `CRON_SECRET` environment variable

**Optional**:
- Email client to verify reminder/host notification delivery
- External cron scheduler (cron-job.org or similar)

---

## Phase C.A: Environment Hardening

### Test 1: Environment Variable Validation

**Goal**: Verify centralized env module and guards

**Steps**:
```bash
# 1. Check env guard script
cd /app
yarn check:env

# Expected: ✅ PASSED: No unauthorized process.env usage found

# 2. Run ESLint
yarn lint

# Expected: No process.env violations (only React Hook warnings)

# 3. Verify env module exports
curl http://localhost:3000/api/health

# Expected: {"ok": true, "message": "Book8 API online"}
```

**Acceptance Criteria**:
- ✅ `check:env` script passes
- ✅ ESLint finds no process.env violations
- ✅ API health check succeeds
- ✅ Application boots without env validation errors

---

## Phase C.B: Notifications & Reminders

### Test 2: Create Booking with Reminders

**Goal**: Verify reminder calculation and storage

**Steps**:

**Option A: Via Public Booking Link**
1. Login and configure scheduling handle at `/dashboard/settings/scheduling`
2. Share public link: `https://your-domain.com/b/{handle}`
3. Create booking for **75 minutes from now**
4. Expected: Booking created with one 1h reminder

**Option B: Via MongoDB (Direct)**
```javascript
// MongoDB Shell
use book8

var now = new Date();
var start = new Date(now.getTime() + 75 * 60 * 1000);
var end = new Date(start.getTime() + 30 * 60 * 1000);
var reminder1h = new Date(start.getTime() - 60 * 60 * 1000);

var user = db.users.findOne({});

db.bookings.insertOne({
  id: UUID().toString(),
  userId: user.id,
  title: "E2E Test - Reminder",
  customerName: "Test Guest",
  guestEmail: user.email,
  guestTimezone: "UTC",
  startTime: start.toISOString(),
  endTime: end.toISOString(),
  timeZone: "UTC",
  notes: "Testing 1h reminder",
  status: "confirmed",
  rescheduleCount: 0,
  reminders: [{
    id: UUID().toString(),
    type: "1h",
    sendAtUtc: reminder1h.toISOString(),
    sentAtUtc: null
  }],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
});

print("✅ Booking created!");
print("Start:", start);
print("Reminder due:", reminder1h);
```

**Verification**:
```javascript
// Check booking has reminder
db.bookings.findOne(
  { title: /E2E Test/ },
  { reminders: 1, startTime: 1, status: 1 }
)

// Expected output:
{
  reminders: [
    {
      id: "...",
      type: "1h",
      sendAtUtc: "2025-10-21T04:15:00.000Z",  // ~15 min from now
      sentAtUtc: null
    }
  ],
  startTime: "2025-10-21T05:15:00.000Z",
  status: "confirmed"
}
```

**Acceptance Criteria**:
- ✅ Booking created with `status: "confirmed"`
- ✅ `reminders` array contains 1h reminder
- ✅ `sendAtUtc` is 1 hour before `startTime`
- ✅ `sentAtUtc` is `null`

### Test 3: Manual Reminder Send (Cron)

**Goal**: Verify cron worker sends due reminders

**Steps**:

**Wait ~15 minutes after booking creation**, then:

```bash
# Trigger cron manually
curl -s "https://your-domain.com/api/cron/sync?secret=$CRON_SECRET&task=reminders" | jq .

# Expected output:
{
  "ok": true,
  "task": "reminders",
  "runId": "3302ac1a-...",
  "processed": 1,
  "successes": 1,
  "failures": 0
}
```

**Verification**:
```javascript
// Check reminder marked as sent
db.bookings.findOne(
  { title: /E2E Test/ },
  { reminders: 1 }
)

// Expected: sentAtUtc is now populated
{
  reminders: [
    {
      id: "...",
      type: "1h",
      sendAtUtc: "2025-10-21T04:15:00.000Z",
      sentAtUtc: "2025-10-21T04:16:23.456Z"  // ✅ Populated!
    }
  ]
}

// Check cron log
db.cron_logs.findOne(
  { task: "reminders" },
  { successes: 1, failures: 1, startedAt: 1 }
).sort({ startedAt: -1 })

// Expected:
{
  task: "reminders",
  successes: 1,
  failures: 0,
  startedAt: ISODate("2025-10-21T04:16:20Z")
}
```

**Email Verification**:
- Check inbox for reminder email to `guestEmail`
- Subject: "Starting soon: E2E Test - Reminder"
- Content: Contains booking time, manage link
- Verify dual timezone display (if guest TZ differs)

**Acceptance Criteria**:
- ✅ Cron returns `successes: 1`
- ✅ `sentAtUtc` updated in booking document
- ✅ Email delivered to guest
- ✅ `cron_logs` entry created

### Test 4: Idempotency Check

**Goal**: Verify duplicate cron runs don't resend

**Steps**:
```bash
# Run cron again immediately
curl -s "https://your-domain.com/api/cron/sync?secret=$CRON_SECRET&task=reminders" | jq .

# Expected output:
{
  "ok": true,
  "task": "reminders",
  "runId": "different-uuid",
  "processed": 0,  // ✅ No reminders processed
  "successes": 0,
  "failures": 0
}
```

**Acceptance Criteria**:
- ✅ `processed: 0` (reminder already sent)
- ✅ No duplicate email received

### Test 5: Host Reschedule Notification

**Goal**: Verify synchronous host notification on reschedule

**Steps**:
1. Get reschedule token from booking confirmation email
2. Visit reschedule page: `/b/{handle}/reschedule?token=...`
3. Select new time and confirm
4. Check host email inbox

**Expected Email**:
- To: Host email (booking owner)
- Subject: "Booking rescheduled: Test Guest – ..."
- Content:
  - Old time (strikethrough)
  - New time (highlighted)
  - PII-safe guest email (`tes***`)
  - Link to view all bookings

**Verification**:
```javascript
// Check booking updated
db.bookings.findOne(
  { title: /E2E Test/ },
  { startTime: 1, rescheduleCount: 1, reminders: 1 }
)

// Expected:
{
  startTime: "2025-10-21T06:00:00.000Z",  // ✅ New time
  rescheduleCount: 1,
  reminders: [
    {
      id: "...",
      type: "1h",
      sendAtUtc: "2025-10-21T05:00:00.000Z",  // ✅ Recalculated!
      sentAtUtc: null  // ✅ Reset for new time
    }
  ]
}
```

**Acceptance Criteria**:
- ✅ Reschedule confirmation email sent to guest
- ✅ Host notification email sent synchronously
- ✅ Old GCal event deleted, new one created
- ✅ Unsent reminders recalculated to new time

### Test 6: Host Cancel Notification

**Goal**: Verify synchronous host notification on cancel

**Steps**:
1. Get cancel token from booking confirmation email
2. Visit cancel link: `/api/public/bookings/cancel?token=...`
3. Confirm cancellation
4. Check host email inbox

**Expected Email**:
- To: Host email
- Subject: "Booking canceled: Test Guest – ..."
- Content:
  - Canceled time (strikethrough)
  - PII-safe guest email
  - Confirmation that slot is now available

**Verification**:
```javascript
db.bookings.findOne(
  { title: /E2E Test/ },
  { status: 1 }
)

// Expected:
{
  status: "canceled"  // ✅ Updated
}
```

**Acceptance Criteria**:
- ✅ Cancellation confirmation page shown to guest
- ✅ Host notification email sent synchronously
- ✅ GCal event deleted
- ✅ Booking status set to "canceled"
- ✅ Future cron runs skip this booking (status filter)

---

## Phase C.C: Analytics & Dashboard

### Test 7: Analytics API

**Goal**: Verify real-time aggregation and performance

**Steps**:
```bash
# Login and get JWT token
TOKEN="your-jwt-token"

# Query 7-day analytics
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/analytics/summary?range=7d" | jq .

# Expected output:
{
  "ok": true,
  "range": "7d",
  "kpis": {
    "bookings": 1,
    "reschedules": 1,
    "cancellations": 1,
    "reminders_sent": 1,
    "avg_lead_time_minutes": 75
  },
  "series": [
    {
      "date": "2025-10-21",
      "bookings": 1,
      "reschedules": 1,
      "cancellations": 1,
      "reminders_sent": 1
    },
    ... 6 more days
  ],
  "meta": {
    "query_time_ms": 87  // ✅ < 300ms
  }
}
```

**Verification**:
```javascript
// Manual count verification
db.bookings.countDocuments({
  userId: "your-user-id",
  createdAt: { $gte: ISODate("2025-10-14T00:00:00Z") }
})

// Should match kpis.bookings

db.cron_logs.aggregate([
  { $match: { task: "reminders", startedAt: { $gte: ISODate("2025-10-14T00:00:00Z") } } },
  { $group: { _id: null, total: { $sum: "$successes" } } }
])

// Should match kpis.reminders_sent
```

**Acceptance Criteria**:
- ✅ API returns 200 OK
- ✅ Query time < 300ms
- ✅ KPIs match manual DB counts
- ✅ Series has 7 entries (one per day)
- ✅ Server-side cache working (60s revalidation)

### Test 8: Dashboard UI

**Goal**: Verify visual analytics display

**Steps**:
1. Login to dashboard: `https://your-domain.com/dashboard`
2. Scroll to "Analytics Dashboard" section
3. Verify all components render

**Expected Display**:
- 4 KPI cards (Bookings, Reschedules, Cancellations, Reminders)
- Line chart: Bookings & Reminders trend
- Bar chart: Reschedules & Cancellations
- Time range selector (7d / 30d)
- Query performance display

**Acceptance Criteria**:
- ✅ All KPI cards show correct numbers
- ✅ Charts render with data points
- ✅ Range selector works (switches between 7d/30d)
- ✅ Loading states display before data loads
- ✅ Error handling graceful if API fails
- ✅ Dark mode properly styled

---

## External Scheduler Setup

### Configure Cron Job (cron-job.org)

**Goal**: Automate reminder sends every 10 minutes

**Steps**:

1. Go to [cron-job.org](https://cron-job.org)
2. Create account and add new cron job
3. Configure:
   - **URL**: `https://your-domain.com/api/cron/sync?secret=YOUR_CRON_SECRET&task=reminders`
   - **Schedule**: `*/10 * * * *` (every 10 minutes)
   - **Timeout**: 30 seconds
   - **Notifications**: Enable for failures
4. Test execution manually
5. Monitor first 24 hours

**Alternative: Vercel Cron**

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync?task=reminders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Acceptance Criteria**:
- ✅ Cron job executes every 10 minutes
- ✅ No failures in first 24 hours
- ✅ Reminders sent within 10 minutes of due time
- ✅ `cron_logs` collection growing

---

## MongoDB Inspection Queries

### Check Booking with Reminders
```javascript
db.bookings.findOne(
  { id: "booking-id-here" },
  { reminders: 1, status: 1, startTime: 1, rescheduleCount: 1 }
)
```

### Recent Cron Runs
```javascript
db.cron_logs.find(
  { task: "reminders" }
).sort({ startedAt: -1 }).limit(5)
```

### Count Unsent Reminders
```javascript
db.bookings.countDocuments({
  status: "confirmed",
  "reminders.sentAtUtc": null,
  "reminders.sendAtUtc": { $lte: new Date().toISOString() }
})
```

### Analytics Aggregation (Manual)
```javascript
db.bookings.aggregate([
  { $match: { 
    userId: "your-user-id",
    createdAt: { $gte: ISODate("2025-10-14T00:00:00Z") }
  }},
  { $group: {
    _id: null,
    total: { $sum: 1 },
    reschedules: { $sum: { $cond: [{ $gt: ["$rescheduleCount", 0] }, 1, 0] } },
    cancellations: { $sum: { $cond: [{ $eq: ["$status", "canceled"] }, 1, 0] } }
  }}
])
```

---

## Final Checklist

### Phase C.A (Environment Hardening)
- [ ] `yarn check:env` passes
- [ ] `yarn lint` finds no process.env violations
- [ ] Zero direct process.env calls outside env.js
- [ ] Application boots successfully

### Phase C.B (Notifications)
- [ ] Booking creation adds reminders
- [ ] 1h reminder sends via cron
- [ ] Idempotency prevents duplicates
- [ ] Host reschedule notification sent
- [ ] Host cancel notification sent
- [ ] Email templates render correctly
- [ ] Dual timezone display works
- [ ] External cron configured

### Phase C.C (Analytics)
- [ ] Analytics API returns data < 300ms
- [ ] KPIs match DB counts
- [ ] Dashboard UI renders all components
- [ ] Charts display trend data
- [ ] Range selector works
- [ ] MongoDB indexes created

### Production Readiness
- [ ] Atlas daily snapshots enabled
- [ ] Vercel alerts configured
- [ ] Sentry error tracking (optional)
- [ ] All environment variables set
- [ ] External cron scheduler active
- [ ] Documentation complete

---

## Troubleshooting

### Reminder Not Sending

**Check**:
1. Booking status is "confirmed" (not "canceled")
2. `sentAtUtc` is null
3. `sendAtUtc` <= current time
4. `RESEND_API_KEY` is set
5. `FEATURE_REMINDERS=true`

**Debug**:
```bash
curl "https://your-domain.com/api/cron/sync?secret=$CRON_SECRET&task=reminders"
```

Check logs for error messages.

### Analytics Query Slow

**Check**:
1. Indexes exist: `db.bookings.getIndexes()`
2. Query time in response: `meta.query_time_ms`
3. Dataset size: `db.bookings.countDocuments({})`

**Optimize**:
- Add projection to fetch only needed fields
- Consider materialized views if > 10,000 bookings

### Host Notification Not Received

**Check**:
1. Resend API key valid
2. Email address correct
3. Check spam folder
4. Verify synchronous send (check console logs)

**Debug**:
```bash
# Check server logs during reschedule/cancel
tail -f /var/log/supervisor/nextjs.out.log
```

---

**Last Updated**: 2025-06-15  
**Version**: 1.0  
**Phase**: C - Complete Validation Guide
