/**
 * BOO-60B: recurring / repeat booking parsing and slot generation (public book + dashboard).
 */

import { randomUUID } from 'crypto'
import { normalizePlanKey } from '@/lib/plan-features'

const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'custom']
const OCCURRENCE_CHOICES = new Set([3, 4, 5, 6, 8, 10, 12])

/**
 * @param {unknown} recurringBody
 * @param {string} businessPlanKey
 * @returns {{ value: { frequency: string, intervalDays: number | null, totalOccurrences: number, seriesId: string } } | { error: string }}
 */
export function parseRecurringFromRequest(recurringBody, businessPlanKey) {
  if (!recurringBody || typeof recurringBody !== 'object' || !recurringBody.enabled) {
    return { value: null }
  }
  if (normalizePlanKey(businessPlanKey) === 'starter') {
    return { error: 'recurring_not_available' }
  }
  const frequency = String(recurringBody.frequency || '')
    .toLowerCase()
    .trim()
  if (!FREQUENCIES.includes(frequency)) {
    return { error: 'invalid_frequency' }
  }
  let intervalDays = null
  if (frequency === 'custom') {
    const n = Math.floor(Number(recurringBody.intervalDays))
    if (!Number.isFinite(n) || n < 1 || n > 90) {
      return { error: 'invalid_interval' }
    }
    intervalDays = n
  }
  const totalOccurrences = Math.floor(Number(recurringBody.totalOccurrences))
  if (!OCCURRENCE_CHOICES.has(totalOccurrences)) {
    return { error: 'invalid_occurrences' }
  }
  return {
    value: {
      frequency,
      intervalDays,
      totalOccurrences,
      seriesId: randomUUID()
    }
  }
}

/**
 * @param {string} firstStartISO
 * @param {string} firstEndISO
 * @param {string} frequency
 * @param {number | null} intervalDays
 * @param {number} totalOccurrences
 * @returns {{ start: string, end: string }[]}
 */
export function buildRecurringSlotTimes(firstStartISO, firstEndISO, frequency, intervalDays, totalOccurrences) {
  const firstS = new Date(firstStartISO)
  const firstE = new Date(firstEndISO)
  if (Number.isNaN(firstS.getTime()) || Number.isNaN(firstE.getTime()) || firstE <= firstS) {
    return []
  }
  const durMs = firstE.getTime() - firstS.getTime()
  const out = []
  for (let i = 0; i < totalOccurrences; i++) {
    if (i === 0) {
      out.push({ start: firstS.toISOString(), end: firstE.toISOString() })
      continue
    }
    const prevStart = new Date(out[i - 1].start)
    let nextStart
    if (frequency === 'weekly') {
      nextStart = new Date(prevStart.getTime() + 7 * 86400000)
    } else if (frequency === 'biweekly') {
      nextStart = new Date(prevStart.getTime() + 14 * 86400000)
    } else if (frequency === 'monthly') {
      nextStart = new Date(prevStart)
      nextStart.setMonth(nextStart.getMonth() + 1)
    } else if (frequency === 'custom') {
      const days = Math.max(1, Math.min(90, intervalDays ?? 7))
      nextStart = new Date(prevStart.getTime() + days * 86400000)
    } else {
      nextStart = new Date(prevStart.getTime() + 7 * 86400000)
    }
    const nextEnd = new Date(nextStart.getTime() + durMs)
    out.push({ start: nextStart.toISOString(), end: nextEnd.toISOString() })
  }
  return out
}
