const { overlaps, buildGoogleEventFromBooking, mergeBook8WithGoogle } = require('../lib/googleSync.cjs')

describe('google sync helpers', () => {
  test('overlaps detects overlapping intervals', () => {
    expect(overlaps('2025-01-01T10:00:00Z','2025-01-01T11:00:00Z','2025-01-01T10:30:00Z','2025-01-01T10:45:00Z')).toBe(true)
    expect(overlaps('2025-01-01T10:00:00Z','2025-01-01T11:00:00Z','2025-01-01T11:00:00Z','2025-01-01T12:00:00Z')).toBe(false)
  })

  test('buildGoogleEventFromBooking maps fields', () => {
    const b = { id: 'b1', title: 'Intro', customerName: 'Alice', notes: 'Bring deck', startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z' }
    const evt = buildGoogleEventFromBooking(b)
    expect(evt.summary).toBe('Intro')
    expect(evt.description).toContain('Customer: Alice')
    expect(evt.description).toContain('Bring deck')
    expect(evt.start.dateTime).toBe('2025-01-01T10:00:00.000Z')
    expect(evt.end.dateTime).toBe('2025-01-01T10:30:00.000Z')
    expect(evt.extendedProperties.private.book8BookingId).toBe('b1')
  })

  test('mergeBook8WithGoogle skips mapped events and flags conflicts', () => {
    const book8 = [{ id: 'b1', title: 'Call', startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T11:00:00Z', source: 'book8', conflict: false }]
    const google = [ { id: 'g1', summary: 'Busy', start: { dateTime: '2025-01-01T10:30:00Z' }, end: { dateTime: '2025-01-01T10:45:00Z' } }, { id: 'g2', summary: 'Later', start: { dateTime: '2025-01-01T12:00:00Z' }, end: { dateTime: '2025-01-01T12:30:00Z' } } ]
    const merged = mergeBook8WithGoogle(book8, google, { })
    const g1 = merged.find(x => x.id === 'google:g1')
    const g2 = merged.find(x => x.id === 'google:g2')
    expect(g1.conflict).toBe(true)
    expect(g2.conflict).toBe(false)
  })
})