/**
 * No-show / card-on-file settings (business.noShowProtection) — BOO-45B.
 */

import { normalizePlanKey } from '@/lib/plan-features'

const WINDOW_OPTIONS = [1, 2, 4, 6, 12, 24, 48, 72]

export function canUseNoShowProtectionPlan(plan) {
  const k = normalizePlanKey(plan)
  return k === 'growth' || k === 'enterprise'
}

/** QA-010: Partial PATCH must not wipe fields — use !== undefined so false/0 are preserved. */
export function normalizeNoShowSettings(body, existing = null) {
  const ex = existing && typeof existing === 'object' ? existing : {}
  const b = body && typeof body === 'object' ? body : {}

  const enabled = b.enabled !== undefined ? !!b.enabled : !!ex.enabled

  const feeType =
    b.feeType === 'percentage' || b.feeType === 'fixed'
      ? b.feeType
      : ex.feeType === 'percentage' || ex.feeType === 'fixed'
        ? ex.feeType
        : 'fixed'

  const feeAmount =
    b.feeAmount !== undefined && b.feeAmount !== null
      ? Math.max(0, Math.min(999999, Number(b.feeAmount) || 0))
      : Math.max(0, Math.min(999999, Number(ex.feeAmount) || 0))

  const wRaw =
    b.cancellationWindowHours !== undefined && b.cancellationWindowHours !== null
      ? Number(b.cancellationWindowHours)
      : Number(ex.cancellationWindowHours)
  const cancellationWindowHours = WINDOW_OPTIONS.includes(wRaw)
    ? wRaw
    : WINDOW_OPTIONS.includes(Number(ex.cancellationWindowHours))
      ? Number(ex.cancellationWindowHours)
      : 24

  const autoCharge =
    b.autoCharge !== undefined
      ? b.autoCharge !== false
      : ex.autoCharge !== undefined
        ? ex.autoCharge !== false
        : false

  const curSource =
    b.currency !== undefined && b.currency !== null ? b.currency : ex.currency || 'cad'
  const currency = String(curSource)
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 3)
  const cur = currency.length === 3 ? currency : 'cad'

  return {
    enabled,
    feeType,
    feeAmount,
    cancellationWindowHours,
    autoCharge,
    currency: cur
  }
}

/** Public booking page + emails — no secrets */
export function sanitizeNoShowForPublic(business) {
  const plan = normalizePlanKey(business?.plan || business?.subscription?.plan)
  if (!canUseNoShowProtectionPlan(plan)) return { enabled: false }
  const ns = business?.noShowProtection && typeof business.noShowProtection === 'object'
    ? business.noShowProtection
    : {}
  if (!ns.enabled) return { enabled: false }
  return {
    enabled: true,
    feeType: ns.feeType === 'percentage' ? 'percentage' : 'fixed',
    feeAmount: typeof ns.feeAmount === 'number' ? ns.feeAmount : Number(ns.feeAmount) || 0,
    cancellationWindowHours:
      typeof ns.cancellationWindowHours === 'number' ? ns.cancellationWindowHours : 24,
    currency: typeof ns.currency === 'string' ? ns.currency.slice(0, 3).toLowerCase() : 'cad'
  }
}

/** Policy block for emails / core-api */
export function noShowPolicyPayload(business) {
  const pub = sanitizeNoShowForPublic(business)
  if (!pub.enabled) return null
  return {
    enabled: true,
    feeAmount: pub.feeAmount,
    feeType: pub.feeType,
    cancellationWindowHours: pub.cancellationWindowHours,
    currency: pub.currency
  }
}

export function computeNoShowFeeCents(policy, servicePriceCents) {
  if (!policy?.enabled) return 0
  if (policy.feeType === 'percentage') {
    const base = Math.max(0, Math.floor(Number(servicePriceCents) || 0))
    return Math.min(99999999, Math.round((base * policy.feeAmount) / 100))
  }
  const amt = Number(policy.feeAmount) || 0
  return Math.min(99999999, Math.round(amt * 100))
}

export function formatMoneyAmount(cents, currency) {
  const cur = (currency || 'cad').toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(
      (Number(cents) || 0) / 100
    )
  } catch {
    return `${(Number(cents) || 0) / 100} ${cur}`
  }
}

/**
 * @param {string|Date} appointmentStartIso
 * @param {Date} now
 * @param {number} windowHours
 */
export function isWithinCancellationFeeWindow(appointmentStartIso, now, windowHours) {
  const start = new Date(appointmentStartIso)
  if (Number.isNaN(start.getTime())) return false
  const ms = Math.max(0, Number(windowHours) || 0) * 3600000
  return start.getTime() - now.getTime() <= ms
}

export function cancellationFeeApplies(booking, business, now = new Date()) {
  const policy = sanitizeNoShowForPublic(business)
  if (!policy.enabled) return { applies: false, policy: null }
  if (!booking?.stripePaymentMethodId) return { applies: false, policy: null }
  const start = booking.startTime || booking.slot?.start
  if (!start) return { applies: false, policy: null }
  const within = isWithinCancellationFeeWindow(start, now, policy.cancellationWindowHours)
  return { applies: within, policy }
}
