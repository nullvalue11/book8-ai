# Phase C: Reminder Architecture & Notifications

## Overview

Phase C.B adds automated guest reminders (24h and 1h before bookings) and synchronous host notifications for reschedules and cancellations.

---

## Reminder System

### Data Model

Each booking document includes a `reminders` array:

```javascript
{
  reminders: [
    {
      id: string,              // UUID for idempotency
      type: '24h' | '1h',      // Reminder type
      sendAtUtc: string,       // ISO datetime when to send
      sentAtUtc: string | null // Set after successful send
    }
  ]
}
```

### Reminder Creation Rules

1. **On Booking Create**: Calculate and add 0-2 future reminders
   - 24h reminder: 24 hours before start time
   - 1h reminder: 1 hour before start time
   - Only creates reminders for times in the future

2. **On Reschedule**: Recompute pending reminders
   - Keep all already-sent reminders (`sentAtUtc` !== null)
   - Recalculate unsent reminders with new start time
   - Skip reminders that would be in the past

3. **On Cancel**: No action on reminders array
   - Cron worker respects `status === 'confirmed'` filter
   - Canceled bookings are automatically skipped

---

## Cron Worker

### Endpoint

`GET /api/cron/sync?secret=CRON_SECRET&task=reminders`

### Execution Schedule

- **Recommended**: Every 10 minutes
- **Vercel Cron**: `*/10 * * * *`
- **Manual trigger**: Use secret parameter for testing

### Workflow

1. **Query bookings** where:
   - `status === 'confirmed'`
   - Has at least one reminder with:
     - `sentAtUtc === null`
     - `sendAtUtc <= now`

2. **For each due reminder**:
   - Fetch owner details
   - Render email template (24h or 1h)
   - Send via Resend with idempotency header:
     ```
     X-Idempotency-Key: reminders/{bookingId}/{reminderId}
     ```
   - On success: Update `sentAtUtc = now`

3. **Log results**:
   - Write to `cron_logs` collection
   - Track: processed, successes, failures

### Idempotency

- **Key format**: `reminders/{bookingId}/{reminderId}`
- **Resend deduplication**: 24-hour window
- **Database deduplication**: `sentAtUtc` check prevents resends
- **Multiple runs safe**: Same reminder won't send twice

### Error Handling

- Individual reminder failures logged but don't stop batch
- First 10 errors stored in cron_logs
- Retries on next cron run if reminder still due and unsent

---

## Email Templates

### Guest Reminders

**24-Hour Reminder** (`emails/reminder-24h.tsx`)
- Subject: `Reminder: {bookingTitle} tomorrow`
- Content:
  - Meeting details in guest timezone
  - Optional host timezone display (if different)
  - Manage booking link

**1-Hour Reminder** (`emails/reminder-1h.tsx`)
- Subject: `Starting soon: {bookingTitle}`
- Content:
  - Urgent styling (orange gradient)
  - Meeting starting in 1 hour notification
  - Quick access to details

### Host Notifications (Synchronous)

**Reschedule Notification** (`emails/host-reschedule.tsx`)
- Sent immediately after reschedule confirmation
- Shows old vs new time (both timezones)
- PII-safe: Masks guest email (`abc***`)
- Link to view all bookings

**Cancel Notification** (`emails/host-cancel.tsx`)
- Sent immediately after cancellation
- Shows canceled time (both timezones)
- PII-safe email masking
- Confirms calendar update

---

## Feature Flag

```javascript
// In env.js
FEATURES: {
  REMINDERS: true  // Enable/disable reminder system
}
```

**Gated logic**:
- Reminder calculation on booking create
- Reminder recomputation on reschedule
- Cron worker execution
- All email sends

---

## API Integration Points

### 1. Booking Creation
**File**: `/app/api/public/[handle]/book/route.js`
```javascript
const reminders = isFeatureEnabled('REMINDERS')
  ? calculateReminders(startTime.toISOString())
  : []
```

### 2. Reschedule Confirmation
**File**: `/app/api/bookings/reschedule/confirm/route.js`
```javascript
if (isFeatureEnabled('REMINDERS') && booking.reminders.length > 0) {
  updatedReminders = recomputeReminders(
    booking.reminders, 
    newStartTime.toISOString()
  )
}
```

### 3. Cancel Endpoint
**File**: `/app/api/public/bookings/cancel/route.js`
- Sends host cancel notification synchronously
- No reminder array modification

---

## Testing

### Manual QA Script

```bash
# 1. Create booking 90 minutes from now (only 1h reminder created)
TOMORROW=$(date -u -d '+90 minutes' +%FT%H:%M:%S)
curl -X POST "https://your-domain/api/public/handle/book" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"QA Test\",
    \"email\": \"qa@example.com\",
    \"start\": \"$TOMORROW\",
    \"end\": \"$(date -u -d '+120 minutes' +%FT%H:%M:%S)\",
    \"notes\": \"Reminder test\"
  }"

# 2. Manually trigger cron
curl "https://your-domain/api/cron/sync?secret=$CRON_SECRET&task=reminders"

# 3. Verify reminder sent
# Check cron_logs collection for successes count

# 4. Reschedule booking to +48h (both reminders now created)
# Re-run cron to confirm no duplicate sends
```

### Unit Tests
**File**: `/app/tests/reminders.test.js`
- `calculateReminders`: Future-only creation
- `recomputeReminders`: Preserves sent, updates unsent
- `getDueReminders`: Filters by status and time
- `markReminderSent`: Updates specific reminder

---

## Monitoring

### Success Metrics
- `cron_logs.successes`: Reminders sent successfully
- `cron_logs.processed`: Total reminders attempted
- `cron_logs.failures`: Send failures

### Key Logs
```javascript
// Cron start
console.log(`[cron:reminders] Found ${count} bookings with due reminders`)

// Individual send
console.log(`[cron:reminders] Sent ${type} reminder for booking ${id}`)

// Errors
console.error(`[cron:reminders] Failed to send reminder ${id}:`, error)
```

---

## Failure Modes & Mitigation

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| **Resend API down** | Fails with error logged | Retries on next cron run |
| **Invalid booking data** | Skips reminder, logs error | Manual intervention if persistent |
| **Cron missed** | Reminders still due on next run | Auto-recovery (time-based query) |
| **Feature flag off** | No reminders sent | Toggle flag to resume |
| **Double send attempt** | Resend idempotency prevents duplicate | No action needed |

---

## Production Checklist

- [ ] Set `FEATURE_REMINDERS=true` in production .env
- [ ] Configure Vercel Cron: `*/10 * * * *` → `/api/cron/sync?task=reminders`
- [ ] Set `CRON_SECRET` environment variable
- [ ] Verify Resend API key has sending permissions
- [ ] Test with booking 2 hours in future (1h reminder only)
- [ ] Monitor `cron_logs` collection for first week
- [ ] Set up alerts on failure rate > 10%

---

## Phase C.C (Next)

**Analytics & Dashboard**
- Aggregate metrics: bookings/day, reschedules, cancellations
- Avg lead time, reminder open rates
- UI cards/charts on `/dashboard`
- Export functionality

---

## Architecture Decisions

1. **Why synchronous host notifications?**
   - Immediate user feedback critical
   - Low failure rate (internal Resend call)
   - Simpler error handling

2. **Why separate cron task?**
   - Decouples reminders from calendar sync
   - Independent scaling and monitoring
   - Allows different intervals

3. **Why Resend idempotency?**
   - Prevents duplicate emails on cron retry
   - 24h window covers multiple cron cycles
   - Database `sentAtUtc` as secondary guard

4. **Why recompute on reschedule?**
   - User expectation: reminders match current time
   - Prevents stale reminder sends
   - Preserves already-sent reminder history

---

**Last Updated**: 2025-06-15  
**Phase**: C.B - Notifications & Reminders  
**Status**: Complete
