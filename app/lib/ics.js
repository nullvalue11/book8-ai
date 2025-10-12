import { format } from 'date-fns-tz'

export function buildICS({ uid, start, end, summary, description = '', organizer, attendees = [], method = 'REQUEST' }) {
  const dtStamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'", { timeZone: 'UTC' })
  const dtStart = format(new Date(start), "yyyyMMdd'T'HHmmss'Z'", { timeZone: 'UTC' })
  const dtEnd = format(new Date(end), "yyyyMMdd'T'HHmmss'Z'", { timeZone: 'UTC' })

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

function escapeText(s = '') { return String(s).replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;') }
