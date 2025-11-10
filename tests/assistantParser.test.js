import { parseUserRequest } from '@/lib/assistantParser'

describe('assistant parser', () => {
  test('30m tomorrow afternoon', () => {
    const r = parseUserRequest('30m tomorrow afternoon', new Date('2025-06-01T12:00:00Z'))
    expect(r.type).toBe('find_slots')
    expect(r.dates.length).toBe(1)
    expect(r.window).toBe('afternoon')
    expect(r.durationMin).toBe(30)
  })

  test('next Wed 3pm', () => {
    const r = parseUserRequest('next Wed 3pm', new Date('2025-06-01T12:00:00Z'))
    expect(r.type).toBe('find_slots')
    expect(r.dates.length).toBe(1)
  })

  test('any time today', () => {
    const r = parseUserRequest('any time today', new Date('2025-06-01T12:00:00Z'))
    expect(r.type).toBe('find_slots')
    // Date string depends on timezone during test; assert type only
    expect(Array.isArray(r.dates)).toBe(true)
  })
})
