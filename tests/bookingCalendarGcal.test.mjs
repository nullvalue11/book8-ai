/**
 * BOO-113 — calendar event id + calendar resolution helpers for core-api bookings.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  getBookingCalendarEventId,
  resolveCalendarIdForUser
} from '../app/lib/bookingCalendarGcal.js'

describe('getBookingCalendarEventId (BOO-113)', () => {
  it('prefers calendarEventId over googleEventId', () => {
    assert.strictEqual(
      getBookingCalendarEventId({ calendarEventId: 'a', googleEventId: 'b' }),
      'a'
    )
  })

  it('falls back to googleEventId', () => {
    assert.strictEqual(getBookingCalendarEventId({ googleEventId: 'legacy' }), 'legacy')
  })

  it('returns null when missing or blank', () => {
    assert.strictEqual(getBookingCalendarEventId(null), null)
    assert.strictEqual(getBookingCalendarEventId({}), null)
    assert.strictEqual(getBookingCalendarEventId({ calendarEventId: '   ' }), null)
  })
})

describe('resolveCalendarIdForUser (BOO-113)', () => {
  it('uses scheduling.selectedCalendarIds[0]', () => {
    assert.strictEqual(
      resolveCalendarIdForUser({
        scheduling: { selectedCalendarIds: ['work@group.calendar.google.com'] }
      }),
      'work@group.calendar.google.com'
    )
  })

  it('falls back to google.selectedCalendarIds then primary', () => {
    assert.strictEqual(
      resolveCalendarIdForUser({
        google: { selectedCalendarIds: ['x'] }
      }),
      'x'
    )
    assert.strictEqual(resolveCalendarIdForUser({}), 'primary')
  })
})
