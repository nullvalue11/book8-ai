/**
 * BOO-101B revenue insights — pure aggregation helpers (unit-tested).
 */

import dateFnsTz from 'date-fns-tz'

const { zonedTimeToUtc } = dateFnsTz
import { getBookingStartMs, isCancelledBooking } from './bookingListUtils.js'

/** @param {unknown} booking */
export function getBookingRevenueCents(booking) {
  if (!booking || typeof booking !== 'object') return null
  const b = booking
  if (b.servicePriceCents != null && Number.isFinite(Number(b.servicePriceCents))) {
    return Math.max(0, Math.floor(Number(b.servicePriceCents)))
  }
  const sp = b.service
  if (sp && typeof sp === 'object' && sp.price != null) {
    const p = Number(sp.price)
    if (!Number.isFinite(p)) return null
    if (p > 1000) return Math.floor(p)
    return Math.round(p * 100)
  }
  if (b.priceCents != null && Number.isFinite(Number(b.priceCents))) {
    return Math.max(0, Math.floor(Number(b.priceCents)))
  }
  if (b.amountCents != null && Number.isFinite(Number(b.amountCents))) {
    return Math.max(0, Math.floor(Number(b.amountCents)))
  }
  return null
}

/**
 * Completed = not cancelled, start strictly before now.
 */
export function isCompletedBookingForInsights(booking, nowMs) {
  if (isCancelledBooking(booking)) return false
  const t = getBookingStartMs(booking)
  if (t == null) return false
  return t < nowMs
}

/** @param {object} booking */
export function getBookingLanguageCode(booking) {
  const raw = booking?.language ?? booking?.guestLanguage ?? 'en'
  const s = String(raw).trim().toLowerCase().slice(0, 12)
  return s || 'en'
}

/**
 * @param {Date} instant
 * @param {string} tz
 * @returns {string} yyyy-MM-dd
 */
export function dateKeyInBusinessTz(instant, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(instant)
      .replace(/\//g, '-')
  } catch {
    return instant.toISOString().slice(0, 10)
  }
}

export function monthRangeUtcInTz(year, month1to12, tz) {
  const pad = (n) => String(n).padStart(2, '0')
  const startStr = `${year}-${pad(month1to12)}-01`
  const nextY = month1to12 === 12 ? year + 1 : year
  const nextM = month1to12 === 12 ? 1 : month1to12 + 1
  const endStr = `${nextY}-${pad(nextM)}-01`
  try {
    const startUtc = zonedTimeToUtc(`${startStr}T00:00:00`, tz)
    const endExclusive = zonedTimeToUtc(`${endStr}T00:00:00`, tz)
    return { startMs: startUtc.getTime(), endExclusiveMs: endExclusive.getTime() }
  } catch {
    const s = Date.UTC(year, month1to12 - 1, 1)
    const e = Date.UTC(year, month1to12, 1)
    return { startMs: s, endExclusiveMs: e }
  }
}

/** Current calendar month in TZ → { year, month } */
export function currentMonthInTz(now, tz) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: 'numeric'
  }).formatToParts(now)
  const y = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10)
  return { year: y, month: m }
}

/**
 * @param {object[]} bookings
 * @param {number} nowMs
 * @param {string} tz
 * @param {number} year
 * @param {number} month 1-12
 */
export function summarizeMonthBookings(bookings, nowMs, tz, year, month) {
  const { startMs, endExclusiveMs } = monthRangeUtcInTz(year, month, tz)
  let count = 0
  let revenueCents = 0
  const langCount = {}

  for (const b of bookings) {
    if (!isCompletedBookingForInsights(b, nowMs)) continue
    const t = getBookingStartMs(b)
    if (t == null || t < startMs || t >= endExclusiveMs) continue
    count += 1
    const cents = getBookingRevenueCents(b)
    if (cents != null) revenueCents += cents
    const lc = getBookingLanguageCode(b)
    langCount[lc] = (langCount[lc] || 0) + 1
  }

  return { count, revenueCents, langCount }
}

/**
 * @param {object[]} bookings
 * @param {number} nowMs
 * @param {string} tz
 * @param {number} daysBack
 */
export function buildDailyTrend(bookings, nowMs, tz, daysBack) {
  const byDay = new Map()
  const startDay = new Date(nowMs - (daysBack - 1) * 86400000)
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(startDay.getTime() + i * 86400000)
    const key = dateKeyInBusinessTz(d, tz)
    byDay.set(key, { date: key, bookings: 0, revenue: 0 })
  }

  for (const b of bookings) {
    if (!isCompletedBookingForInsights(b, nowMs)) continue
    const t = getBookingStartMs(b)
    if (t == null) continue
    const key = dateKeyInBusinessTz(new Date(t), tz)
    if (!byDay.has(key)) continue
    const row = byDay.get(key)
    row.bookings += 1
    const cents = getBookingRevenueCents(b)
    if (cents != null) row.revenue += cents / 100
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function topServicesThisMonth(bookings, nowMs, tz, year, month, limit = 5) {
  const { startMs, endExclusiveMs } = monthRangeUtcInTz(year, month, tz)
  const byId = new Map()

  for (const b of bookings) {
    if (!isCompletedBookingForInsights(b, nowMs)) continue
    const t = getBookingStartMs(b)
    if (t == null || t < startMs || t >= endExclusiveMs) continue
    const cents = getBookingRevenueCents(b)
    const sid = String(b.serviceId ?? b.service?.id ?? 'unknown')
    const name =
      String(b.serviceName ?? b.service?.name ?? b.title ?? 'Service').slice(0, 200) || 'Service'
    if (!byId.has(sid)) {
      byId.set(sid, { serviceId: sid, name, count: 0, revenueCents: 0 })
    }
    const row = byId.get(sid)
    row.count += 1
    if (cents != null) row.revenueCents += cents
  }

  const total = Array.from(byId.values()).reduce((s, x) => s + x.revenueCents, 0)
  return Array.from(byId.values())
    .sort((a, b) => b.revenueCents - a.revenueCents || b.count - a.count)
    .slice(0, limit)
    .map((x) => ({
      serviceId: x.serviceId,
      name: x.name,
      count: x.count,
      revenue: Math.round(x.revenueCents) / 100,
      pctOfTotal: total > 0 ? Math.round((x.revenueCents / total) * 1000) / 10 : 0
    }))
}

/**
 * @param {Record<string, Array<{start:string,end:string}>>} weeklyHours
 * @param {number} monday0Sunday6
 * @param {number} hour 0-23
 */
export function isWithinWorkingHours(weeklyHours, monday0Sunday6, hour) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return null
  const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const key = keys[monday0Sunday6]
  const dayFull = {
    mon: 'monday',
    tue: 'tuesday',
    wed: 'wednesday',
    thu: 'thursday',
    fri: 'friday',
    sat: 'saturday',
    sun: 'sunday'
  }[key]
  const segs =
    weeklyHours[key] ||
    weeklyHours[dayFull] ||
    weeklyHours[String(monday0Sunday6)] ||
    []
  if (!Array.isArray(segs) || segs.length === 0) return false
  const toMin = (hm) => {
    const [h, m] = String(hm || '0:0').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const cur = hour * 60 + 30
  for (const seg of segs) {
    if (!seg?.start || !seg?.end) continue
    let endM = toMin(seg.end)
    const startM = toMin(seg.start)
    if (String(seg.end) === '23:59') endM = 24 * 60
    if (cur >= startM && cur < endM) return true
  }
  return false
}

/** Monday=0 .. Sunday=6 in business TZ */
export function getMondayBasedDowAndHour(callMs, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz || 'UTC',
      weekday: 'short',
      hour: 'numeric',
      hour12: false
    }).formatToParts(new Date(callMs))
    const wk = (parts.find((p) => p.type === 'weekday')?.value || 'Mon').toLowerCase()
    const hr = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10)
    const map = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const short = wk.slice(0, 3)
    const dow = map[short] ?? 0
    return { dow, hour: hr }
  } catch {
    const d = new Date(callMs)
    const dow = (d.getUTCDay() + 6) % 7
    return { dow, hour: d.getUTCHours() }
  }
}

/**
 * @returns {{ dayOfWeek: number, hour: number, count: number }[]}
 */
export function buildHourHeatmap(calls, tz, weeklyHours, minDaysHint = 14) {
  const cell = new Map()
  let oldest = Infinity
  let newest = 0
  for (const c of calls) {
    const raw = c.startTime || c.createdAt || c.endedAt
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms)) continue
    oldest = Math.min(oldest, ms)
    newest = Math.max(newest, ms)
  }
  const spanDays = (newest - oldest) / 86400000
  if (calls.length === 0 || spanDays < minDaysHint) return []

  for (const c of calls) {
    const raw = c.startTime || c.createdAt || c.endedAt
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms)) continue
    const { dow, hour } = getMondayBasedDowAndHour(ms, tz)
    if (hour < 6 || hour > 22) continue
    const k = `${dow}-${hour}`
    cell.set(k, (cell.get(k) || 0) + 1)
  }

  const out = []
  for (const [k, count] of cell) {
    if (count <= 0) continue
    const [d, h] = k.split('-').map(Number)
    out.push({ dayOfWeek: d, hour: h, count })
  }
  return out
}

export function countCallsInRange(calls, startMs, endExclusiveMs) {
  let n = 0
  for (const c of calls) {
    const raw = c.startTime || c.createdAt
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms) || ms < startMs || ms >= endExclusiveMs) continue
    n += 1
  }
  return n
}

export function countAfterHoursCalls(calls, tz, weeklyHours, startMs, endExclusiveMs) {
  if (!weeklyHours || typeof weeklyHours !== 'object') return 0
  let n = 0
  for (const c of calls) {
    const raw = c.startTime || c.createdAt
    if (!raw) continue
    const ms = new Date(raw).getTime()
    if (Number.isNaN(ms) || ms < startMs || ms >= endExclusiveMs) continue
    const { dow, hour } = getMondayBasedDowAndHour(ms, tz)
    const inside = isWithinWorkingHours(weeklyHours, dow, hour)
    if (inside === false) n += 1
  }
  return n
}
