import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz'
import { addMinutes, isAfter, parseISO } from 'date-fns'

export function buildSlotsForDate({ dateISO, timeZone, workingBlocks = [], durationMin = 30, bufferMin = 0, minNoticeMin = 120 }) {
  // dateISO: YYYY-MM-DD (in user's tz)
  const slots = []
  const now = new Date()
  const noticeCutoff = addMinutes(now, minNoticeMin)

  for (const block of workingBlocks) {
    const [sh, sm] = block.start.split(':').map(Number)
    const [eh, em] = block.end.split(':').map(Number)
    let cursorUtc = zonedTimeToUtc(`${dateISO}T${pad2(sh)}:${pad2(sm)}:00`, timeZone)
    const endUtc = zonedTimeToUtc(`${dateISO}T${pad2(eh)}:${pad2(em)}:00`, timeZone)

    while (cursorUtc < endUtc) {
      const slotEnd = addMinutes(cursorUtc, durationMin)
      const withBufferStart = addMinutes(cursorUtc, -bufferMin)
      const withBufferEnd = addMinutes(slotEnd, bufferMin)
      if (slotEnd <= endUtc && isAfter(withBufferStart, noticeCutoff)) {
        slots.push({ startUtc: cursorUtc, endUtc: slotEnd, windowStartUtc: withBufferStart, windowEndUtc: withBufferEnd })
      }
      cursorUtc = addMinutes(cursorUtc, durationMin)
    }
  }
  return slots
}

export function pad2(n) { return String(n).padStart(2, '0') }

export function isoUtc(dt) { return new Date(dt).toISOString() }

export function weekdayKey(dateISO, timeZone) {
  const zoned = utcToZonedTime(zonedTimeToUtc(`${dateISO}T00:00:00`, timeZone), timeZone)
  const day = zoned.getDay() // 0=Sun
  return ['sun','mon','tue','wed','thu','fri','sat'][day]
}

export function slotsToResponse(slots, tz) {
  return slots.map(s => ({ start: isoUtc(s.startUtc), end: isoUtc(s.endUtc), tz }))
}
