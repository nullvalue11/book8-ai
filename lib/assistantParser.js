// Simple rule-based parser for scheduling phrases
// Returns one of:
// { type: 'find_slots', dates: ['YYYY-MM-DD', ...], window?: 'morning'|'afternoon'|'evening', durationMin?: number }
// { type: 'book', start: ISO, end: ISO, hostTz?: string }
// { type: 'clarify' }

function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

export function parseUserRequest(text, now = new Date()) {
  const t = (text || '').toLowerCase().trim()
  if (!t) return { type: 'clarify' }

  // duration
  let durationMin = 30
  const durMatch = t.match(/(\d+)\s*(m|min|minutes|minute)/)
  if (durMatch) durationMin = parseInt(durMatch[1], 10)

  // time-of-day window
  let window
  if (/morning/.test(t)) window = 'morning'
  else if (/afternoon/.test(t)) window = 'afternoon'
  else if (/(evening|tonight|late)/.test(t)) window = 'evening'

  const base = new Date(now)
  const today = toDateStr(base)
  const tomorrow = (() => { const d = new Date(base); d.setDate(d.getDate()+1); return toDateStr(d) })()

  // absolute time today e.g., "3pm", "15:30"
  const absTimeMatch = t.match(/\b((1[0-2]|0?[1-9])(:[0-5][0-9])?\s*(am|pm))\b|\b([01]?\d|2[0-3]):[0-5]\d\b/)
  const dayKeyword = /tomorrow/.test(t) ? 'tomorrow' : /today/.test(t) ? 'today' : /next\s+(mon|tue|tues|weds?|thu|thur|thurs|fri|sat|sun)/.test(t) ? 'nextdow' : ''

  if (dayKeyword === 'today' && absTimeMatch) {
    // We cannot convert to exact ISO without tz on server; client will use availability+filter
    return { type: 'find_slots', dates: [today], window, durationMin }
  }
  if (dayKeyword === 'tomorrow') {
    return { type: 'find_slots', dates: [tomorrow], window, durationMin }
  }
  if (dayKeyword === 'nextdow') {
    const m = t.match(/next\s+(mon|tue|tues|weds?|thu|thur|thurs|fri|sat|sun)/)
    const map = { mon:1, tue:2, tues:2, wed:3, weds:3, thu:4, thur:4, thurs:4, fri:5, sat:6, sun:0 }
    const targetDow = map[m[1]]
    let d = new Date(base)
    const currentDow = d.getDay()
    let delta = (targetDow - currentDow + 7) % 7
    if (delta === 0) delta = 7
    d.setDate(d.getDate() + delta)
    return { type: 'find_slots', dates: [toDateStr(d)], window, durationMin }
  }

  if (/any time today|anytime today|any time|whenever/.test(t)) {
    return { type: 'find_slots', dates: [today], window, durationMin }
  }

  if (/book\b/.test(t) && /\d{4}-\d{2}-\d{2}t\d{2}:/i.test(t)) {
    // naive ISO in text
    const iso = t.match(/\d{4}-\d{2}-\d{2}t\d{2}:[0-5]\d(?::[0-5]\d)?z?/i)?.[0]
    if (iso) {
      const start = new Date(iso)
      const end = new Date(start.getTime() + durationMin * 60000)
      return { type: 'book', start: start.toISOString(), end: end.toISOString() }
    }
  }

  // default
  return { type: 'find_slots', dates: [today], window, durationMin }
}

export default { parseUserRequest }
