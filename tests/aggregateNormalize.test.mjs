/**
 * BOO-90B — normalizeAggregateStats must read book8-core-api aggregate/stats field names.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { normalizeAggregateStats } from '../app/components/dashboard/aggregateNormalize.js'

describe('normalizeAggregateStats (BOO-90B)', () => {
  it('maps totalBookingsThisMonth and totalCallsThisMonth from core-api', () => {
    const raw = {
      totalBusinesses: 2,
      totalBookingsToday: 0,
      totalBookingsThisWeek: 3,
      totalBookingsThisMonth: 5,
      totalCallsToday: 0,
      totalCallsThisWeek: 2,
      totalCallsThisMonth: 4,
      totalNoShows: 0,
      totalCancellations: 0,
      totalRevenue: 0,
      businesses: [
        { id: 'biz_a', name: 'Loc A', bookingsToday: 0, callsToday: 1, noShowRate: 0 },
        { id: 'biz_b', name: 'Loc B', bookingsToday: 0, callsToday: 0, noShowRate: 0 }
      ]
    }
    const n = normalizeAggregateStats(raw)
    assert.strictEqual(n.totalBookings, 5)
    assert.strictEqual(n.totalCalls, 4)
    assert.strictEqual(n.activeLocations, 2)
    assert.strictEqual(n.locationRows.length, 2)
    assert.strictEqual(n.locationRows[0].businessId, 'biz_a')
    assert.strictEqual(n.locationRows[0].callsToday, 1)
  })

  it('still accepts legacy shorter keys', () => {
    const n = normalizeAggregateStats({ bookingsThisMonth: 2, callsThisMonth: 1, businesses: [] })
    assert.strictEqual(n.totalBookings, 2)
    assert.strictEqual(n.totalCalls, 1)
  })
})
