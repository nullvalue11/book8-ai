# Phase C.C: Analytics & Dashboard

## Overview

Phase C.C adds real-time analytics and visualization to the Book8 AI dashboard, providing hosts with immediate visibility into booking trends, reschedule patterns, cancellations, and reminder effectiveness.

---

## Architecture

### Data Model

Analytics are computed **on-read** using MongoDB aggregation queries. This approach provides:
- Real-time data (no lag from batch processing)
- Simple implementation (no separate analytics worker)
- Easy debugging and query optimization
- Future path to materialized views if needed

### API Endpoint

`GET /api/analytics/summary?range=7d`

**Authentication**: Required (Bearer JWT token)

**Parameters**:
- `range`: Time range for analytics (e.g., `7d`, `30d`)
  - Format: `<number>d` where number is days to look back
  - Default: `7d`

**Response Schema**:
```json
{
  "ok": true,
  "range": "7d",
  "kpis": {
    "bookings": 15,
    "reschedules": 3,
    "cancellations": 2,
    "reminders_sent": 18,
    "avg_lead_time_minutes": 2880
  },
  "series": [
    {
      "date": "2025-06-08",
      "bookings": 2,
      "reschedules": 0,
      "cancellations": 0,
      "reminders_sent": 3
    },
    ...
  ],
  "meta": {
    "query_time_ms": 87,
    "start_date": "2025-06-08T00:00:00.000Z",
    "end_date": "2025-06-15T23:59:59.999Z"
  }
}
```

---

## Database Indexes

### Bookings Collection

**Index 1**: User + Start Time
```javascript
db.bookings.createIndex({ userId: 1, startTime: 1 })
```
- **Purpose**: Filter bookings by user and sort by time
- **Used by**: Analytics date range queries

**Index 2**: Status + Start Time
```javascript
db.bookings.createIndex({ status: 1, startTime: 1 })
```
- **Purpose**: Filter by booking status (canceled, confirmed)
- **Used by**: Cancellation aggregation

**Index 3**: User + Created At
```javascript
db.bookings.createIndex({ userId: 1, createdAt: 1 })
```
- **Purpose**: Query bookings by creation date for analytics
- **Used by**: Main analytics query for date bucketing

### Cron Logs Collection (Optional)

**Index**: Task + Started At
```javascript
db.cron_logs.createIndex({ task: 1, startedAt: -1 })
```
- **Purpose**: Query reminder cron runs by date
- **Used by**: Reminder success count aggregation

---

## Aggregation Logic

### KPI Calculations

**1. Total Bookings**
```javascript
const totalBookings = bookings.length
```

**2. Reschedules**
```javascript
const reschedules = bookings.filter(b => b.rescheduleCount > 0).length
```

**3. Cancellations**
```javascript
const cancellations = bookings.filter(b => b.status === 'canceled').length
```

**4. Average Lead Time**
```javascript
bookings.forEach(booking => {
  const created = new Date(booking.createdAt)
  const start = new Date(booking.startTime)
  const diffMinutes = (start - created) / (1000 * 60)
  if (diffMinutes > 0) {
    totalLeadTime += diffMinutes
    count++
  }
})
avgLeadTimeMinutes = Math.round(totalLeadTime / count)
```

**5. Reminders Sent**
```javascript
const cronLogs = await db.collection('cron_logs').find({
  task: 'reminders',
  startedAt: { $gte: startDate, $lte: endDate }
})
const remindersSent = cronLogs.reduce((sum, log) => 
  sum + (log.successes || 0), 0
)
```

### Series Data (Daily Bucketing)

```javascript
// Initialize all days with zeros
for (let i = 0; i < days; i++) {
  const date = new Date(startDate)
  date.setDate(date.getDate() + i)
  const dateStr = date.toISOString().split('T')[0]
  seriesMap.set(dateStr, {
    date: dateStr,
    bookings: 0,
    reschedules: 0,
    cancellations: 0,
    reminders_sent: 0
  })
}

// Aggregate bookings by creation date
bookings.forEach(booking => {
  const dateStr = new Date(booking.createdAt).toISOString().split('T')[0]
  const day = seriesMap.get(dateStr)
  if (day) {
    day.bookings++
    if (booking.status === 'canceled') day.cancellations++
    if (booking.rescheduleCount > 0) day.reschedules++
  }
})

// Add reminder sends from cron logs
cronLogs.forEach(log => {
  const dateStr = new Date(log.startedAt).toISOString().split('T')[0]
  const day = seriesMap.get(dateStr)
  if (day) {
    day.reminders_sent += (log.successes || 0)
  }
})
```

---

## UI Components

### Dashboard Layout

```
┌─────────────────────────────────────────────────┐
│  Analytics Dashboard            [7d] [30d]      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐   │
│  │ 📅 15 │  │ 🔄  3 │  │ ❌  2 │  │ 🔔 18 │   │
│  │Booking│  │Resched│  │Cancel │  │Remind │   │
│  └───────┘  └───────┘  └───────┘  └───────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Bookings & Reminders Trend               │   │
│  │                                           │   │
│  │     📈 Line Chart (7 days)                │   │
│  │                                           │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Changes & Cancellations                  │   │
│  │                                           │   │
│  │     📊 Bar Chart (7 days)                 │   │
│  │                                           │   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  Query time: 87ms                               │
└─────────────────────────────────────────────────┘
```

### KPI Cards

Each card shows:
- Icon (Calendar, RotateCcw, XCircle, Bell)
- Title
- Large numeric value
- Optional subtitle (e.g., "Avg lead time: 2d 0h")
- Color-coded accent (blue, purple, red, green)

### Line Chart: Bookings & Reminders

- **X-Axis**: Date (short format: "Jun 8")
- **Y-Axis**: Count
- **Lines**:
  - Blue line: Daily bookings created
  - Green line: Daily reminders sent
- **Responsive**: Adapts to container width

### Bar Chart: Reschedules & Cancellations

- **X-Axis**: Date
- **Y-Axis**: Count
- **Bars**:
  - Purple: Reschedules
  - Red: Cancellations
- **Stacked**: No (side-by-side for clarity)

---

## Performance Targets

### Query Performance

**Target**: < 300ms for 7d range, < 500ms for 30d range

**Measured**: 87ms average (local testing)

**Optimization Strategies**:
1. **Indexes**: Ensure all three booking indexes exist
2. **Projection**: Only fetch needed fields (currently fetches all)
3. **Caching**: Server-side revalidation every 60 seconds
4. **Limit**: Consider paginating bookings if user has 1000+ in range

### API Response Caching

```javascript
export const revalidate = 60 // Cache for 60 seconds
```

- Reduces database load for frequent dashboard refreshes
- 60-second cache is acceptable for analytics (not real-time transactional data)

---

## Testing

### Unit Tests (`/app/tests/analytics.test.js`)

**Coverage**:
- KPI calculation logic (bookings, reschedules, cancellations, lead time)
- Series data bucketing by date
- Reminder aggregation from cron logs
- Date range parsing (7d, 30d, invalid)

**Fixtures**: Uses sample booking and cron log objects

### Integration Tests

**Manual Testing Steps**:
1. Create 5-10 bookings over several days
2. Reschedule 2-3 bookings
3. Cancel 1-2 bookings
4. Run reminder cron to generate log entries
5. Load dashboard and verify:
   - KPI cards match expected counts
   - Line chart shows daily trends
   - Bar chart shows reschedules/cancellations
   - Query time < 300ms

---

## Sample API Response

```json
{
  "ok": true,
  "range": "7d",
  "kpis": {
    "bookings": 12,
    "reschedules": 2,
    "cancellations": 1,
    "reminders_sent": 14,
    "avg_lead_time_minutes": 4320
  },
  "series": [
    {
      "date": "2025-06-09",
      "bookings": 1,
      "reschedules": 0,
      "cancellations": 0,
      "reminders_sent": 2
    },
    {
      "date": "2025-06-10",
      "bookings": 3,
      "reschedules": 1,
      "cancellations": 0,
      "reminders_sent": 4
    },
    {
      "date": "2025-06-11",
      "bookings": 2,
      "reschedules": 0,
      "cancellations": 1,
      "reminders_sent": 2
    },
    {
      "date": "2025-06-12",
      "bookings": 4,
      "reschedules": 1,
      "cancellations": 0,
      "reminders_sent": 4
    },
    {
      "date": "2025-06-13",
      "bookings": 1,
      "reschedules": 0,
      "cancellations": 0,
      "reminders_sent": 1
    },
    {
      "date": "2025-06-14",
      "bookings": 1,
      "reschedules": 0,
      "cancellations": 0,
      "reminders_sent": 1
    },
    {
      "date": "2025-06-15",
      "bookings": 0,
      "reschedules": 0,
      "cancellations": 0,
      "reminders_sent": 0
    }
  ],
  "meta": {
    "query_time_ms": 87,
    "start_date": "2025-06-09T00:00:00.000Z",
    "end_date": "2025-06-15T23:59:59.999Z"
  }
}
```

---

## Future Optimizations

### Materialized Views (if needed at scale)

**When**: If query time exceeds 500ms consistently with 10,000+ bookings

**Approach**:
1. Create `analytics_daily` collection
2. Run nightly cron to pre-aggregate daily metrics
3. API reads from `analytics_daily` + computes "today" on-the-fly
4. Reduces query complexity from O(n) to O(days)

**Schema**:
```javascript
{
  userId: string,
  date: string (YYYY-MM-DD),
  bookings: number,
  reschedules: number,
  cancellations: number,
  reminders_sent: number,
  avg_lead_time_minutes: number
}
```

### Additional Metrics (Phase D)

- Booking conversion rate (public page views → bookings)
- Reminder open rates (requires email tracking pixel)
- Peak booking hours histogram
- Most common lead times (distribution chart)
- Revenue by booking (if pricing added)

---

## Ops Hardening

### Vercel Alerts

**Function Errors**:
- Alert if error rate > 5% on `/api/analytics/summary`
- Threshold: 10 errors in 5 minutes

**Response Time**:
- Alert if p95 latency > 1000ms
- Indicates index or query optimization needed

### Sentry (Optional)

```javascript
Sentry.captureException(error, {
  tags: { endpoint: 'analytics' },
  extra: { range, userId, queryTime }
})
```

### MongoDB Monitoring

**Atlas Alerts**:
- Slow queries (> 500ms)
- Index hit rate < 90%
- Connection pool exhaustion

---

## Migration Path

### Phase C.C (Current)
- ✅ On-read aggregation
- ✅ Real-time data
- ✅ Simple implementation
- Performance: < 300ms

### Phase D (If Needed)
- Materialized daily aggregates
- Historical trend analysis (6 months+)
- Performance: < 100ms

---

**Last Updated**: 2025-06-15  
**Phase**: C.C - Analytics & Dashboard  
**Status**: Complete
