export function buildICS({ uid, start, end, summary, description = '', organizer, attendees = [], method = 'REQUEST' }) {
  const dtStamp = toICSTimestamp(new Date())
  const dtStart = toICSTimestamp(new Date(start))
  const dtEnd = toICSTimestamp(new Date(end))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Book8//EN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    organizer ? `ORGANIZER:mailto:${organizer}` : null,
    ...attendees.map(a => `ATTENDEE;CN=${escapeText(a.name || a.email)}:mailto:${a.email}`),
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean)

  return lines.join('\r\n')
}

function toICSTimestamp(date) {
  // Convert to UTC and format YYYYMMDDTHHMMSSZ without milliseconds
  const iso = date.toISOString() // e.g., 2025-06-20T14:23:45.123Z
  const compact = iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') // 20250620T142345Z
  return compact
}

function escapeText(s = '') { return String(s).replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') }
