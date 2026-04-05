/**
 * Client waitlist entries (BOO-59B) — MongoDB + optional core-api proxy.
 */

import { randomUUID } from 'crypto'

export const WAITLIST_COLLECTION = 'waitlist_entries'

export const WAITLIST_TIME_RANGES = ['morning', 'afternoon', 'evening', 'any']

export const WAITLIST_STATUSES = ['waiting', 'notified', 'booked', 'expired']

/**
 * @param {object} p
 * @param {string} p.businessId
 * @param {string} p.handle
 * @param {string} [p.serviceId]
 * @param {string} [p.serviceName]
 * @param {string[]} p.preferredDates
 * @param {string} p.preferredTimeRange
 * @param {string} p.name
 * @param {string} p.email
 * @param {string} [p.phone]
 */
export function newWaitlistEntry(p) {
  const dates = Array.isArray(p.preferredDates)
    ? [...new Set(p.preferredDates.map((d) => String(d).trim()).filter(Boolean))].slice(0, 8)
    : []
  const tr = WAITLIST_TIME_RANGES.includes(p.preferredTimeRange) ? p.preferredTimeRange : 'any'
  return {
    id: randomUUID(),
    businessId: String(p.businessId || ''),
    handle: String(p.handle || '').slice(0, 120),
    serviceId: p.serviceId != null ? String(p.serviceId).slice(0, 120) : '',
    serviceName: typeof p.serviceName === 'string' ? p.serviceName.slice(0, 200) : '',
    preferredDates: dates,
    preferredTimeRange: tr,
    customerName: String(p.name || '').trim().slice(0, 120),
    email: String(p.email || '').trim().slice(0, 200).toLowerCase(),
    phone: typeof p.phone === 'string' ? p.phone.trim().slice(0, 40) : '',
    status: 'waiting',
    createdAt: new Date()
  }
}

export function sanitizeWaitlistEntryForOwner(doc) {
  if (!doc || typeof doc !== 'object') return null
  const rawId = doc.id != null ? doc.id : doc._id
  return {
    id: rawId != null ? String(rawId) : '',
    businessId: String(doc.businessId || ''),
    serviceId: doc.serviceId || '',
    serviceName: doc.serviceName || '',
    preferredDates: Array.isArray(doc.preferredDates) ? doc.preferredDates : [],
    preferredTimeRange: doc.preferredTimeRange || 'any',
    customerName: doc.customerName || '',
    email: doc.email || '',
    phone: doc.phone || '',
    status: WAITLIST_STATUSES.includes(doc.status) ? doc.status : 'waiting',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt || ''
  }
}
