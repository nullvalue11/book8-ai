const { buildGoogleEventFromBooking } = require('../lib/googleSync.cjs')

describe('timezone mapping', () => {
  test('uses booking timeZone for Google event', () => {
    const b = { id: 'b1', title: 'Intro', startTime: '2025-06-01T14:00:00Z', endTime: '2025-06-01T15:00:00Z', timeZone: 'America/Toronto' }
    const evt = buildGoogleEventFromBooking(b)
    expect(evt.start.timeZone).toBe('America/Toronto')
    expect(evt.end.timeZone).toBe('America/Toronto')
    expect(evt.extendedProperties.private.timeZone).toBe('America/Toronto')
  })
})