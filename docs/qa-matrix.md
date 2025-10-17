# QA Test Matrix: Timezone Coverage

## Test Environments

| Timezone | UTC Offset | Daylight Saving |
|----------|-----------|----------------|
| America/Los_Angeles | UTC-8/-7 | PDT (Mar-Nov) |
| America/New_York | UTC-5/-4 | EDT (Mar-Nov) |
| Europe/London | UTC+0/+1 | BST (Mar-Oct) |
| Australia/Sydney | UTC+10/+11 | AEDT (Oct-Apr) |

---

## Test Scenarios

### 1. Create Booking

**Test:** Guest books appointment in their local timezone

| Guest TZ | Host TZ | Test Date | Status | Notes |
|----------|---------|-----------|--------|-------|
| Los Angeles | New York | TBD | ⏳ Pending | 3h difference |
| New York | London | TBD | ⏳ Pending | 5h difference |
| London | Sydney | TBD | ⏳ Pending | 10h difference |
| Sydney | Los Angeles | TBD | ⏳ Pending | Cross date line |
| Los Angeles | Los Angeles | TBD | ⏳ Pending | Same TZ baseline |

**Pass Criteria:**
- ✅ Slot times display correctly in guest TZ
- ✅ Confirmation email shows both guest & host times
- ✅ ICS file imports with correct time
- ✅ Google Calendar event created at correct time
- ✅ No timezone offset errors

---

### 2. Reschedule Booking

**Test:** Guest reschedules to different time, potentially crossing timezone boundaries

| Original TZ | New TZ | Scenario | Status | Notes |
|-------------|--------|----------|--------|-------|
| LA Morning | LA Evening | Same day reschedule | ⏳ Pending | |
| NY 9am | NY 2pm | Business hours shift | ⏳ Pending | |
| London 10am | London 3pm | Afternoon move | ⏳ Pending | |
| Sydney 2pm | Sydney 5pm | EOD shift | ⏳ Pending | |
| LA 8am → NY 11am | LA 5pm → NY 8pm | Cross-country time | ⏳ Pending | Complex |

**Pass Criteria:**
- ✅ Old event deleted from calendar
- ✅ New event created at correct time
- ✅ Reschedule email shows old vs new times (dual TZ)
- ✅ ICS file METHOD:REQUEST with updated time
- ✅ Reschedule count incremented
- ✅ No duplicate events

---

### 3. Cancel Booking

**Test:** Guest cancels booking from any timezone

| Booking TZ | Cancel From TZ | Status | Notes |
|------------|---------------|--------|-------|
| Los Angeles | Los Angeles | ⏳ Pending | Same TZ |
| New York | London | ⏳ Pending | Different TZ |
| London | Sydney | ⏳ Pending | Far timezone |
| Sydney | Los Angeles | ⏳ Pending | Cross date line |

**Pass Criteria:**
- ✅ Event removed from Google Calendar
- ✅ Cancellation email sent (METHOD:CANCEL)
- ✅ ICS file includes CANCEL method
- ✅ Booking status updated to 'canceled'
- ✅ No orphaned calendar events

---

## Email Validation

### Dual Timezone Display

**Example Expected Format:**
```
Your Time: Monday, October 14, 2:00 PM PDT
Host Time: Monday, October 14, 5:00 PM EDT
```

| Guest TZ | Host TZ | Email Shows Both | ICS Correct | Status |
|----------|---------|-----------------|-------------|--------|
| PDT | EDT | ⏳ | ⏳ | Pending |
| EDT | GMT | ⏳ | ⏳ | Pending |
| GMT | AEDT | ⏳ | ⏳ | Pending |
| AEDT | PDT | ⏳ | ⏳ | Pending |

---

## ICS Import Testing

### Calendar Compatibility

**Test:** Import .ics file into various calendar applications

| Calendar App | Import Works | Time Correct | All Day? | Status |
|--------------|-------------|--------------|----------|--------|
| Google Calendar | ⏳ | ⏳ | ⏳ | Pending |
| Outlook (Web) | ⏳ | ⏳ | ⏳ | Pending |
| Outlook (Desktop) | ⏳ | ⏳ | ⏳ | Pending |
| Apple Calendar | ⏳ | ⏳ | ⏳ | Pending |
| Thunderbird | ⏳ | ⏳ | ⏳ | Pending |

**Pass Criteria:**
- ✅ Event imports without errors
- ✅ Start/end times match email
- ✅ Not marked as "all day" event
- ✅ Timezone preserved (shows in user's local time)
- ✅ Reschedule updates existing event (same UID)

---

## Edge Cases

### Daylight Saving Time Transitions

| Scenario | Test Date | Status | Notes |
|----------|-----------|--------|-------|
| Book before DST → Meeting after DST | Spring Forward | ⏳ | 1h shift |
| Book during DST → Meeting after DST ends | Fall Back | ⏳ | 1h shift |
| Meeting during DST transition hour | 2am-3am March | ⏳ | Critical |

### Date Line Crossing

| Scenario | Status | Notes |
|----------|--------|-------|
| Sydney Fri 11pm → LA Thu 6am | ⏳ | Cross date line booking |
| LA Wed 9pm → Sydney Fri 2pm | ⏳ | Next day for Sydney |
| Reschedule across date boundary | ⏳ | Complex scenario |

### Midnight Bookings

| Scenario | Status | Notes |
|----------|--------|-------|
| 24/7 schedule: Book at 00:00 | ⏳ | Midnight start |
| 24/7 schedule: Book at 23:30 | ⏳ | Late night |
| Reschedule from 23:45 to 00:15 | ⏳ | Cross midnight |

---

## Rate Limiting Tests

**Test:** Ensure rate limits don't block legitimate timezone-based requests

| Scenario | Expected | Status |
|----------|----------|--------|
| 5 availability checks in 1 min (same TZ) | Allow | ⏳ |
| 15 availability checks in 1 min (same TZ) | Block after 10 | ⏳ |
| Availability checks from 4 different TZs | Allow (different IPs) | ⏳ |
| 2 reschedules in 1 hour | Allow | ⏳ |
| 4 reschedules in 1 hour | Block after 3 | ⏳ |

---

## Manual Test Checklist

### Pre-Test Setup
- [ ] Create test booking page with 24/7 availability
- [ ] Configure Google Calendar integration
- [ ] Set up Resend email (or check logs)
- [ ] Clear rate limit cache
- [ ] Document test user credentials

### Test Execution
- [ ] Run create tests for all 4 TZs
- [ ] Verify emails received with dual TZ
- [ ] Check Google Calendar events
- [ ] Download and import .ics files
- [ ] Run reschedule tests
- [ ] Verify old events deleted
- [ ] Check reschedule count limits
- [ ] Run cancel tests
- [ ] Verify cancellation emails (METHOD:CANCEL)
- [ ] Test edge cases (DST, date line, midnight)

### Post-Test Validation
- [ ] Review telemetry logs
- [ ] Check for any 500 errors
- [ ] Verify no orphaned events
- [ ] Confirm rate limiting worked
- [ ] Document any failures

---

## Test Results Summary

### Overall Pass Rate

| Category | Pass | Fail | Pending | % Complete |
|----------|------|------|---------|------------|
| Create Booking | 0 | 0 | 5 | 0% |
| Reschedule | 0 | 0 | 5 | 0% |
| Cancel | 0 | 0 | 4 | 0% |
| Email Dual TZ | 0 | 0 | 4 | 0% |
| ICS Import | 0 | 0 | 5 | 0% |
| Edge Cases | 0 | 0 | 6 | 0% |
| Rate Limiting | 0 | 0 | 5 | 0% |
| **TOTAL** | **0** | **0** | **34** | **0%** |

---

## Known Issues

| Issue # | Description | Severity | Status | Workaround |
|---------|-------------|----------|--------|------------|
| - | None yet | - | - | - |

---

## Test Log Template

### Test: [Scenario Name]

**Date:** YYYY-MM-DD  
**Tester:** Name  
**Environment:** Dev / Staging / Production

**Steps:**
1. Step 1
2. Step 2
3. Step 3

**Expected Result:**
- Expected behavior

**Actual Result:**
- What actually happened

**Status:** ✅ Pass / ❌ Fail / ⚠️ Partial

**Screenshots:**
- Link to screenshot

**Notes:**
- Any additional observations

---

## Sign-Off

### QA Approval

- [ ] All critical tests passing
- [ ] No P0/P1 bugs remaining
- [ ] Edge cases documented
- [ ] Performance acceptable (<500ms API)
- [ ] Email delivery confirmed
- [ ] ICS import validated

**QA Lead:** _________________  
**Date:** _________________

**Ready for Production:** Yes / No

---

## Next Steps

After completing this matrix:
1. Update status emojis (⏳ → ✅ or ❌)
2. Document all failures in "Known Issues"
3. Create bug tickets for failures
4. Retest after fixes
5. Update pass rate
6. Get QA sign-off
7. Proceed to production deployment

---

## Automated Test Coverage

Future: Convert this manual matrix to automated E2E tests

**Priority Tests to Automate:**
1. Create booking in each TZ
2. Reschedule across TZ
3. Dual TZ email validation
4. ICS UID stability check
5. Rate limit enforcement

**Test Framework:** Playwright / Jest
**Target:** 80% automation coverage
