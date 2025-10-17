# Phase C & Production Readiness Roadmap

## 📋 Current Status
- ✅ Phase A: Core booking system
- ✅ Phase B: Reschedule + Guest TZ
- 🚧 Phase C: Hardening + Notifications + Analytics
- ⏳ Phase D: AI Assistant

---

## 🎯 Phase C: Final QA + Hardening (2-3 days)

### A. Environment & Debug Cleanup ⚡ (4 hours)

**Priority: HIGH - Do First**

**Tasks:**
1. Create `lib/env.ts` for fail-fast validation
2. Gate all debug logs behind `DEBUG_LOGS=1`
3. Add required env var documentation

**Deliverables:**
- Branch: `chore/cleanup-and-env-guard`
- Typed config export
- Boot-time validation
- No debug spam in production

**Ready Prompt:**
```
Create branch chore/cleanup-and-env-guard.

1. Create lib/env.ts that:
   - Validates all required environment variables at boot
   - Exports typed config object
   - Throws descriptive errors for missing vars
   - Checks: MONGO_URL, DB_NAME, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_BASE_URL
   - Optional: TAVILY_API_KEY, DEBUG_LOGS

2. Update all API routes to use:
   import { env } from '@/lib/env'
   Instead of process.env directly

3. Gate debug logs:
   - Replace console.log('=== DEBUG ===') with if (env.DEBUG_LOGS) console.log()
   - Keep error logs always on
   - Document DEBUG_LOGS=1 usage in README

4. Add env.example with all required variables

Open PR with:
- ✅ Type-safe config
- ✅ Boot-time validation
- ✅ Clean production logs
- ✅ Documentation
```

---

### B. Timezone Testing Matrix 🌍 (3 hours)

**Priority: HIGH**

**Test Coverage:**
- America/Los_Angeles (PST/PDT)
- America/New_York (EST/EDT)
- Europe/London (GMT/BST)
- Australia/Sydney (AEDT/AEST)

**Test Scenarios:**
1. Book in each TZ
2. Reschedule across TZ
3. Cancel from each TZ
4. Email dual-TZ display
5. ICS import (Google + Outlook)

**Ready Prompt:**
```
Create comprehensive timezone test suite.

Branch: test/timezone-matrix

1. Create tests/e2e/timezone-matrix.test.js:
   - Test booking in 4 timezones
   - Verify slot generation respects TZ
   - Check email dual-TZ display
   - Validate ICS timezone blocks
   - Test reschedule across TZ boundaries

2. Mock scenarios:
   - Guest in LA books with host in NYC
   - Guest in Sydney books with host in London
   - Reschedule from GMT to EST
   - Cancel from any TZ

3. Validate:
   - Slots show correct local time
   - Emails show both TZ
   - ICS imports correctly
   - No TZ offset bugs

Deliverable: Passing test suite covering all 4 TZs
```

---

### C. Google OAuth Resilience 🔄 (2 hours)

**Priority: MEDIUM**

**Tasks:**
1. Test disconnect → reconnect flow
2. Verify refresh token persistence
3. Add 401 retry logic
4. Handle expired tokens gracefully

**Ready Prompt:**
```
Improve Google OAuth resilience.

Branch: fix/google-oauth-resilience

1. Add retry logic for 401s in:
   - lib/googleSync.js
   - Booking/reschedule routes

2. Token refresh helper:
   async function refreshGoogleToken(userId) {
     // Fetch refresh token
     // Get new access token
     // Update user record
     // Return new token
   }

3. Error handling:
   - Catch 401 → try refresh → retry once
   - If still fails → notify user to reconnect
   - Log oauth errors clearly

4. Test:
   - Manually revoke token
   - Verify auto-refresh works
   - Check reconnect flow

Deliverable: Robust OAuth with auto-recovery
```

---

## 📧 Phase C.B: Notifications & Automation (1 day)

### Reminder System 🔔 (5 hours)

**Priority: HIGH**

**Features:**
- 24h reminder
- 1h reminder
- Idempotent sends
- Cron worker

**Data Model:**
```javascript
booking.reminders = [
  { type: '24h', sendAtUtc: ISO, sentAt?: ISO },
  { type: '1h', sendAtUtc: ISO, sentAt?: ISO }
]
```

**Ready Prompt:**
```
Implement reminder notification system.

Branch: feat/notifications-reminders

1. Update booking schema:
   - Add reminders array
   - Calculate sendAtUtc on booking creation
   - Recalculate on reschedule

2. Create /api/cron/reminders route:
   - Auth: ?secret=<CRON_SECRET>
   - Find bookings with due reminders
   - Check sentAt === null
   - Send Resend email
   - Mark sentAt with timestamp
   - Idempotent (can run multiple times)

3. Create reminder email template:
   - Use existing branded template
   - Show booking details
   - Include reschedule/cancel links
   - Dual timezone display

4. Add to vercel.json:
   {
     "crons": [{
       "path": "/api/cron/reminders",
       "schedule": "*/10 * * * *"
     }]
   }

5. Test:
   - Mock booking 25h in future
   - Run cron manually
   - Verify email sent
   - Verify sentAt marked
   - Run again → no duplicate

Deliverable: Working reminder system with cron
```

---

### Host Notifications 📬 (3 hours)

**Priority: MEDIUM**

**Events:**
- Guest reschedules
- Guest cancels
- New booking (already done)

**Ready Prompt:**
```
Add host notifications for reschedule/cancel.

Branch: feat/host-notifications

1. Create email templates:
   - bookingRescheduledHost(booking, oldTime, newTime)
   - bookingCancelledHost(booking, reason)

2. Update reschedule confirm route:
   - After successful reschedule
   - Send email to host (owner.email)
   - Include old vs new time comparison
   - Show guest info

3. Update cancel route:
   - Send email to host
   - Include cancelled booking details
   - Show reason if provided

4. Template features:
   - Branded design
   - Clear action summary
   - Link to booking details
   - Calendar update note

Deliverable: Host receives emails on all guest actions
```

---

## 📊 Phase C.C: Analytics Dashboard (1 day)

### Metrics Collection 📈 (4 hours)

**Priority: MEDIUM**

**Metrics:**
- Bookings per day
- Reschedules count
- Cancellations count
- Completion rate
- Average lead time
- Rate limit hits

**Ready Prompt:**
```
Build analytics system and dashboard.

Branch: feat/analytics-dashboard

1. Create analytics aggregation:
   - Nightly cron or on-demand compute
   - Aggregate last 30 days
   - Store in analytics_daily collection OR compute from bookings

2. Metrics to track:
   {
     date: 'YYYY-MM-DD',
     bookingsCreated: number,
     bookingsCompleted: number,
     reschedules: number,
     cancellations: number,
     avgLeadTimeHours: number,
     rateLimitHits: number
   }

3. Create /api/analytics route (auth required):
   - GET /api/analytics?period=7d|30d|90d
   - Return aggregated metrics
   - Include trends (up/down vs previous period)

4. Dashboard UI (/dashboard):
   - Add "Analytics" card
   - Show key metrics as numbers
   - Line chart: bookings over time
   - Bar chart: reschedules vs cancellations
   - Use recharts or similar

5. Indexes:
   db.bookings.createIndex({ createdAt: 1, status: 1 })
   db.bookings.createIndex({ userId: 1, createdAt: -1 })

Deliverable: Analytics dashboard with charts
```

---

## 🔒 Production Readiness Checklist

### Security Hardening 🛡️ (3 hours)

**Ready Prompt:**
```
Production security hardening.

Branch: security/production-hardening

1. JWT Scoping:
   - Add 'audience' field to tokens
   - Auth tokens: aud='auth'
   - Reschedule tokens: aud='reschedule'
   - Cancel tokens: aud='cancel'
   - Validate aud in verify functions

2. Nonce Enforcement:
   - Server-side check for used nonces
   - Log all nonce usage
   - Prevent replay attacks

3. Stripe Webhook:
   - Verify signature on every request
   - Check timestamp (within 5 min)
   - Use idempotency key in DB
   - Log all webhook events

4. CORS:
   - Update to specific domain
   - Remove wildcard (*)
   - Add to env config

5. PII Masking:
   - Mask emails in logs (use first 3 chars + ***)
   - Never log full names
   - Use bookingId instead of email in telemetry

Deliverable: Hardened security for production
```

---

### Database Optimization 💾 (2 hours)

**Ready Prompt:**
```
Add production database indexes and TTLs.

Branch: chore/db-indexes-and-ttls

1. Create migration script (scripts/add-indexes.js):

db.bookings.createIndex({ userId: 1, startTime: 1 }, { name: 'user_schedule' })
db.bookings.createIndex({ 'rescheduleNonces.nonce': 1 }, { name: 'nonce_lookup', sparse: true })
db.bookings.createIndex({ status: 1, startTime: 1 }, { name: 'status_time' })
db.bookings.createIndex({ guestEmail: 1, status: 1 }, { name: 'guest_status' })
db.bookings.createIndex({ createdAt: 1 }, { name: 'created_date' })

db.users.createIndex({ 'scheduling.handleLower': 1 }, { unique: true, sparse: true, name: 'handle_unique' })
db.users.createIndex({ email: 1 }, { unique: true, name: 'email_unique' })

db.password_reset_tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expire' })
db.password_reset_tokens.createIndex({ token: 1 }, { unique: true, name: 'token_unique' })

2. Document in README:
   - How to run migrations
   - Index purposes
   - Performance expectations

3. Backup configuration:
   - Document Atlas backup setup
   - Point-in-time recovery
   - Retention policy

Deliverable: All indexes added, documented
```

---

### Observability 📡 (2 hours)

**Ready Prompt:**
```
Set up Sentry and Vercel alerts.

Branch: ops/sentry-and-alerts

1. Install Sentry:
   yarn add @sentry/nextjs
   npx @sentry/wizard@latest -i nextjs

2. Configure Sentry:
   - sentry.client.config.js
   - sentry.server.config.js
   - Mask PII in beforeSend
   - Add requestId to context
   - Include handle for booking routes

3. Vercel Alerts (vercel.json):
   {
     "alerts": {
       "functionErrors": {
         "threshold": 10,
         "period": "1h"
       },
       "statusCodes": {
         "5xx": {
           "threshold": 5,
           "period": "5m"
         }
       }
     }
   }

4. Add alert documentation:
   - Where to find alerts
   - How to respond
   - Escalation policy

Deliverable: Sentry integrated, alerts configured
```

---

## 🚀 Launch Plan

### Pre-Launch Checklist ✅

```markdown
- [ ] All Phase C features merged
- [ ] Security hardening complete
- [ ] Database indexes added
- [ ] Observability configured
- [ ] ENV vars in production
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Backup enabled
- [ ] Alert rules active
```

### Launch Day 🎉

**Ready Prompt:**
```
Execute production launch.

1. Merge to main:
   git checkout main
   git merge feature/reschedule-timezone
   git tag v0.3.0-phase-b
   git push origin main --tags

2. Configure custom domain:
   - Add book8.ai to Vercel
   - Update DNS (CNAME)
   - Set NEXT_PUBLIC_BASE_URL=https://book8.ai
   - Verify SSL

3. Smoke tests:
   - Book in 4 timezones
   - Reschedule once
   - Cancel one
   - Check emails
   - Verify GCal events
   - Test ICS import

4. Monitor for 48h:
   - Watch error rates
   - Check alert channels
   - Review logs
   - User feedback

5. Document:
   - Release notes
   - Known issues
   - Support contact
```

---

## 🤖 Phase D: AI Assistant (Future)

### Scoping Document

**Features:**
- Natural language booking
- "Find me a time with Wais next week"
- Uses existing availability API
- Confirmation step before booking
- Dual-TZ summary

**Components:**
1. `/assistant` page - Chat UI
2. `/api/search/booking-assistant` - NLP → API
3. Intent parsing (duration, date range, email)
4. Confirmation flow

**MVP Timeline:** 3-4 days after Phase C

---

## 📋 Priority Order for Execution

### Week 1: Core Hardening
1. ⚡ Environment validation (4h)
2. ⚡ Debug log cleanup (2h)
3. 🌍 Timezone test matrix (3h)
4. 🔔 Reminder system (5h)

### Week 2: Polish & Deploy
5. 🛡️ Security hardening (3h)
6. 📊 Analytics dashboard (4h)
7. 💾 Database optimization (2h)
8. 📡 Observability (2h)
9. 🚀 Launch

### Week 3: Post-Launch
10. 📬 Host notifications (3h)
11. 🔄 OAuth resilience (2h)
12. 🐛 Bug fixes from production
13. 🤖 Phase D planning

---

## 🎯 Next Immediate Action

**I recommend starting with:**

**Option A: Environment Hardening (safest)**
```
Start with chore/cleanup-and-env-guard
- Creates solid foundation
- Prevents production issues
- Easy to test locally
- Quick win (4 hours)
```

**Option B: Reminder System (user-facing)**
```
Start with feat/notifications-reminders
- Immediate user value
- Reduces no-shows
- Tests full email pipeline
- Medium complexity (5 hours)
```

**Which would you like to tackle first?** 

Or shall I proceed with **Option A** (Environment Hardening) to build a solid foundation?
