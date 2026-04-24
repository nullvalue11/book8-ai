/**
 * BOO-117B — Payload shape for core-api POST /internal/business/sync-calendar-state
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { buildSyncCalendarStatePayload } from '../app/lib/syncCalendarStatePayload.js'

describe('buildSyncCalendarStatePayload (BOO-117B)', () => {
  it('builds connect payload for Google', () => {
    const connectedAt = '2026-04-23T12:00:00.000Z'
    const p = buildSyncCalendarStatePayload({
      businessId: 'biz_1',
      connected: true,
      provider: 'google',
      connectedAt,
      calendarId: null,
      lastSyncedAt: null
    })
    assert.deepStrictEqual(p, {
      businessId: 'biz_1',
      calendar: {
        connected: true,
        provider: 'google',
        connectedAt,
        calendarId: null,
        lastSyncedAt: null
      },
      calendarProvider: 'google'
    })
  })

  it('builds disconnect payload with nulls', () => {
    const p = buildSyncCalendarStatePayload({
      businessId: 'biz_2',
      connected: false,
      provider: null,
      connectedAt: null,
      calendarId: null,
      lastSyncedAt: null
    })
    assert.strictEqual(p.calendar.connected, false)
    assert.strictEqual(p.calendar.provider, null)
    assert.strictEqual(p.calendar.connectedAt, null)
    assert.strictEqual(p.calendarProvider, null)
  })

  it('coerces connected to boolean', () => {
    const p = buildSyncCalendarStatePayload({
      businessId: 'x',
      connected: 1,
      provider: 'microsoft',
      connectedAt: null,
      calendarId: 'cal@x',
      lastSyncedAt: 't1'
    })
    assert.strictEqual(p.calendar.connected, true)
    assert.strictEqual(p.calendar.calendarId, 'cal@x')
  })
})
