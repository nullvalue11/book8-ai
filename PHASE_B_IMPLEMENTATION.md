# Phase B: Reschedule + Guest Timezone - Implementation Guide

## Status: Foundation Complete, Ready for Final Implementation

### ✅ Completed Infrastructure

1. **Security & Tokens** (`/app/lib/security/`)
   - `rescheduleToken.js` - 48h JWT tokens with nonce
   - `resetToken.js` - Existing cancel token system

2. **Rate Limiting** (`/app/lib/rateLimiting.js`)
   - In-memory store with auto-cleanup
   - Configurations: publicBooking (10/min), reschedule (3/hour)

3. **Telemetry** (`/app/lib/telemetry.js`)
   - Structured logging for all events
   - BookingTelemetry, RateLimitTelemetry, logError

4. **Email Templates** (`/app/lib/email/templates.js`)
   - Professional branded HTML templates
   - Dual timezone display (guest + host)
   - Calendar buttons, reschedule/cancel links
   - Templates: confirmation, reminder, reschedule

5. **Feature Flags** (`.env`)
   ```
   FEATURE_RESCHEDULE=true
   FEATURE_GUEST_TZ=true
   RESEND_API_KEY=your_key_here
   ```

### 📋 Implementation Checklist

#### A. Database Schema Updates

**Bookings Collection:**
```javascript
{
  id: string,
  userId: string,
  guestEmail: string,
  guestTimezone: string | null,
  title: string,
  startTime: ISO string,
  endTime: ISO string,
  timeZone: string,
  status: 'scheduled' | 'rescheduled' | 'canceled',
  rescheduleCount: number (default 0),
  rescheduleHistory: [{
    from: { start: ISO, end: ISO },
    to: { start: ISO, end: ISO },
    at: ISO,
    by: 'guest' | 'owner'
  }],
  rescheduleNonces: [{
    nonce: string,
    issuedAt: ISO,
    usedAt: ISO | null,
    expiresAt: ISO
  }],
  googleEventId: string,
  googleCalendarId: string,
  notes: string,
  createdAt: ISO,
  updatedAt: ISO
}
```

**Index to add:**
```javascript
db.bookings.createIndex({ 'rescheduleNonces.nonce': 1 })
db.bookings.createIndex({ guestEmail: 1, status: 1 })
```

#### B. API Endpoints to Complete

1. **GET /api/public/[handle]/availability**
   - Query params: `date`, `tz`, `duration`
   - Returns: `{ ok: true, slots: [{ start, end }] }`
   - Rate limit: 10/min per IP
   - Features: guest TZ conversion, FreeBusy check

2. **POST /api/public/[handle]/book**
   - Body: `{ name, email, notes, start, end, guestTimezone }`
   - Creates booking with guestTimezone
   - Inserts Google Calendar event
   - Sends confirmation email with ICS
   - Returns: `{ ok: true, bookingId }`

3. **POST /api/bookings/:id/reschedule/request** (owner)
   - Auth: JWT token (owner)
   - Generates reschedule token
   - Saves nonce to booking
   - Emails guest with reschedule link
   - Rate limit: 3/hour per booking

4. **GET /api/bookings/reschedule**
   - Query param: `token`
   - Verifies token, returns booking info
   - Returns: `{ ok: true, booking: {...}, settings: {...} }`

5. **POST /api/bookings/reschedule/confirm**
   - Body: `{ token, newStart, newEnd }`
   - Validates: token, count < 3, FreeBusy
   - Deletes old GCal event
   - Creates new GCal event
   - Updates booking status
   - Marks nonce as used
   - Sends confirmation emails
   - Returns: `{ ok: true }`

#### C. Frontend Pages

1. **Public Booking Page** (`/app/app/b/[handle]/page.js`)
   - Auto-detect timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone`
   - Timezone dropdown override
   - Display slots in guest TZ
   - URL param `?tz=...` persistence

2. **Reschedule Page** (`/app/app/b/[handle]/reschedule/page.js`)
   - Token validation
   - Current booking display
   - Slot picker in guest TZ
   - Success/error states
   - Max reschedule limit message

3. **Enhanced Dashboard Card** (`/app/app/page.js`)
   - "Copy handle" button
   - "Open settings" shortcut
   - "Test as Guest" opens in new tab with TZ badge

#### D. ICS Generation Updates

**File:** `/app/app/lib/ics.js`

```javascript
export function generateBookingICS(booking, owner, method = 'REQUEST') {
  return buildICS({
    uid: `booking-${booking.id}@book8.ai`,
    start: booking.startTime,
    end: booking.endTime,
    summary: booking.title,
    description: `${booking.notes || ''}

---
Manage your booking:
Reschedule: ${baseUrl}/b/${owner.scheduling?.handle}/reschedule?token=${booking.rescheduleToken}
Cancel: ${baseUrl}/api/public/bookings/cancel?token=${booking.cancelToken}

Source: Book8 AI Public Booking
Booking ID: ${booking.id}`,
    organizer: 'noreply@book8.ai',
    attendees: [{ email: booking.guestEmail, name: booking.customerName }],
    method
  })
}
```

#### E. Email Integration

**Update confirmation emails:**
```javascript
import { bookingConfirmationEmail } from '@/lib/email/templates'

// In booking creation:
const emailHtml = bookingConfirmationEmail(
  booking,
  owner,
  baseUrl,
  rescheduleToken,
  cancelToken,
  booking.guestTimezone
)

// Attach ICS
const icsContent = generateBookingICS(booking, owner, 'REQUEST')
await resend.emails.send({
  from: 'Book8 AI <bookings@book8.ai>',
  to: booking.guestEmail,
  cc: owner.email,
  subject: `Your Book8 meeting is confirmed – ${formatDate(booking.startTime, booking.guestTimezone)}`,
  html: emailHtml,
  attachments: [{
    filename: 'booking.ics',
    content: Buffer.from(icsContent).toString('base64')
  }]
})
```

#### F. Rate Limiting Implementation

**In each endpoint:**
```javascript
import { checkRateLimit } from '@/lib/rateLimiting'
import { RateLimitTelemetry } from '@/lib/telemetry'

const clientIp = request.headers.get('x-forwarded-for') || 'unknown'
const rateLimit = checkRateLimit(clientIp, 'reschedule')

if (!rateLimit.allowed) {
  RateLimitTelemetry.exceeded(clientIp, 'reschedule', clientIp)
  return NextResponse.json(
    { ok: false, error: 'Too many requests. Please try again later.' },
    { status: 429, headers: {
      'X-RateLimit-Limit': '3',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': rateLimit.resetAt.toString()
    }}
  )
}
```

#### G. Telemetry Logging

**Throughout codebase:**
```javascript
import { BookingTelemetry, logError } from '@/lib/telemetry'

// On booking creation
BookingTelemetry.created(booking.id, 'public', owner.email)

// On reschedule
BookingTelemetry.rescheduled(booking.id, booking.guestEmail, booking.rescheduleCount)

// On errors
logError(error, { endpoint: '/api/bookings/reschedule', bookingId })
```

### 🧪 Testing Checklist

- [ ] Token: issue → open → confirm → invalid after use
- [ ] Token expiry shows friendly message
- [ ] Max 3 reschedules limit works
- [ ] TZ conversions correct in UI, email, ICS
- [ ] Google event moves correctly (delete old, create new)
- [ ] No duplicate events
- [ ] Both parties receive emails with ICS
- [ ] ICS imports correctly in Google/Outlook
- [ ] Rate limiting blocks after threshold
- [ ] Telemetry logs key events
- [ ] No tokens/secrets in logs

### 🚀 Quick Wins (Separate PRs)

1. **Reminder Emails** (vercel.json cron)
   ```json
   {
     "crons": [{
       "path": "/api/cron/reminders",
       "schedule": "*/15 * * * *"
     }]
   }
   ```

2. **Calendar Notes Mapping**
   ```javascript
   description: `${booking.notes || 'No notes'}

---
Source: Book8 AI Public Booking
Guest: ${booking.guestEmail}
Booking ID: ${booking.id}`
   ```

3. **Enhanced Public Card**
   - Copy handle button
   - Test link with TZ detection

### 📝 PR Template

```markdown
## Phase B: Secure Reschedule + Guest Timezone

### Features
- ✅ 48h reschedule tokens (one-time use)
- ✅ Max 3 reschedules per booking
- ✅ Guest timezone support (auto-detect + dropdown)
- ✅ Dual timezone display in emails
- ✅ Rate limiting (10 req/min booking, 3 req/hour reschedule)
- ✅ Telemetry logging
- ✅ Branded email templates
- ✅ Stable ICS UIDs with METHOD support

### API Endpoints
- GET /api/public/[handle]/availability
- POST /api/public/[handle]/book
- POST /api/bookings/:id/reschedule/request
- GET /api/bookings/reschedule
- POST /api/bookings/reschedule/confirm

### Frontend
- Public booking page with TZ support
- Reschedule page with token validation
- Enhanced dashboard card

### Testing
- All 10 checklist items passing
- Demo link: [handle]/reschedule?token=...

### Demo Steps
1. Book at /b/testhandle
2. Receive confirmation email
3. Click reschedule link
4. Select new time
5. Verify email with updated ICS
6. Confirm Google Calendar updated
```
