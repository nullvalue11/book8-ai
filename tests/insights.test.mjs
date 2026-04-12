/**
 * BOO-101B — insights aggregation (Node native test runner).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBookingRevenueCents,
  isCompletedBookingForInsights,
  summarizeMonthBookings,
  topServicesThisMonth,
  buildHourHeatmap,
  getBookingLanguageCode,
  monthRangeUtcInTz
} from '../app/lib/insightsAggregation.js'

describe('insightsAggregation (BOO-101B)', () => {
  it('getBookingRevenueCents prefers servicePriceCents', () => {
    assert.equal(
      getBookingRevenueCents({ servicePriceCents: 1999 }),
      1999
    )
    assert.equal(
      getBookingRevenueCents({ service: { price: 45 } }),
      4500
    )
    assert.equal(getBookingRevenueCents({ service: { price: 4500 } }), 4500)
    assert.equal(getBookingRevenueCents({}), null)
  })

  it('isCompletedBookingForInsights excludes cancelled and future', () => {
    const now = Date.parse('2025-06-15T12:00:00Z')
    assert.equal(
      isCompletedBookingForInsights(
        { status: 'cancelled', slot: { start: '2025-06-10T10:00:00Z' } },
        now
      ),
      false
    )
    assert.equal(
      isCompletedBookingForInsights(
        { status: 'confirmed', slot: { start: '2025-06-20T10:00:00Z' } },
        now
      ),
      false
    )
    assert.equal(
      isCompletedBookingForInsights(
        { status: 'confirmed', slot: { start: '2025-06-10T10:00:00Z' } },
        now
      ),
      true
    )
  })

  it('getBookingLanguageCode normalizes codes', () => {
    assert.equal(getBookingLanguageCode({ language: 'FR' }), 'fr')
    assert.equal(getBookingLanguageCode({ guestLanguage: '  es-MX ' }), 'es-mx')
  })

  it('summarizeMonthBookings buckets by calendar month and counts languages', () => {
    const tz = 'UTC'
    const year = 2025
    const month = 6
    const nowMs = Date.parse('2025-06-15T18:00:00Z')
    const { startMs } = monthRangeUtcInTz(year, month, tz)
    const t0 = startMs + 2 * 86400000

    const bookings = [
      {
        status: 'confirmed',
        slot: { start: new Date(t0).toISOString() },
        servicePriceCents: 5000,
        language: 'en'
      },
      {
        status: 'confirmed',
        slot: { start: new Date(t0 + 3600000).toISOString() },
        servicePriceCents: 3000,
        language: 'fr'
      },
      {
        status: 'cancelled',
        slot: { start: new Date(t0).toISOString() },
        servicePriceCents: 9000,
        language: 'en'
      }
    ]

    const s = summarizeMonthBookings(bookings, nowMs, tz, year, month)
    assert.equal(s.count, 2)
    assert.equal(s.revenueCents, 8000)
    assert.equal(s.langCount.en, 1)
    assert.equal(s.langCount.fr, 1)
  })

  it('topServicesThisMonth sorts by revenue then count', () => {
    const nowMs = Date.parse('2025-06-20T12:00:00Z')
    const tz = 'UTC'
    const year = 2025
    const month = 6
    const { startMs } = monthRangeUtcInTz(year, month, tz)
    const t0 = startMs + 86400000

    const bookings = [
      {
        serviceId: 'a',
        serviceName: 'Cut',
        status: 'confirmed',
        slot: { start: new Date(t0).toISOString() },
        servicePriceCents: 1000
      },
      {
        serviceId: 'b',
        serviceName: 'Color',
        status: 'confirmed',
        slot: { start: new Date(t0 + 1000).toISOString() },
        servicePriceCents: 1000
      },
      {
        serviceId: 'b',
        serviceName: 'Color',
        status: 'confirmed',
        slot: { start: new Date(t0 + 2000).toISOString() },
        servicePriceCents: 1000
      },
      {
        serviceId: 'c',
        serviceName: 'Cheap',
        status: 'confirmed',
        slot: { start: new Date(t0 + 3000).toISOString() }
      }
    ]

    const top = topServicesThisMonth(bookings, nowMs, tz, year, month, 5)
    assert.equal(top[0].serviceId, 'b')
    assert.equal(top[0].count, 2)
    assert.equal(top[1].serviceId, 'a')
    assert.equal(top[2].serviceId, 'c')
    assert.equal(top[2].revenue, 0)
  })

  it('buildHourHeatmap returns [] when span < minDays', () => {
    const calls = [
      { startTime: '2025-01-01T14:00:00Z' },
      { startTime: '2025-01-05T14:00:00Z' }
    ]
    const out = buildHourHeatmap(calls, 'UTC', { mon: [{ start: '9:00', end: '17:00' }] }, 14)
    assert.deepEqual(out, [])
  })
})
