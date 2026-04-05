/**
 * Client review invites (JWT) and public payloads (BOO-58B).
 */

import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'

export const REVIEWS_COLLECTION = 'client_reviews'
export const REVIEW_INVITE_FLAG = 'reviewInvite'

/** Default link validity (seconds) — 30 days */
export const REVIEW_INVITE_TTL_SEC = 60 * 60 * 24 * 30

/**
 * @param {object} p
 * @param {string} p.businessId
 * @param {string} p.bookingId
 * @param {string} [p.lang]
 * @param {string} [p.customerName]
 * @param {string} [p.serviceName]
 * @param {string|Date} [p.appointmentAt] ISO or Date
 * @param {string} secret JWT_SECRET
 * @param {number} [ttlSec]
 */
export function signReviewInviteToken(p, secret, ttlSec = REVIEW_INVITE_TTL_SEC) {
  const payload = {
    [REVIEW_INVITE_FLAG]: true,
    bid: p.businessId,
    bookingId: p.bookingId,
    lang: p.lang && /^[a-z]{2}$/i.test(p.lang) ? String(p.lang).toLowerCase().slice(0, 2) : 'en',
    customerName: typeof p.customerName === 'string' ? p.customerName.slice(0, 120) : '',
    serviceName: typeof p.serviceName === 'string' ? p.serviceName.slice(0, 200) : '',
    appointmentAt:
      p.appointmentAt instanceof Date
        ? p.appointmentAt.toISOString()
        : typeof p.appointmentAt === 'string'
          ? p.appointmentAt.slice(0, 40)
          : ''
  }
  return jwt.sign(payload, secret, { expiresIn: ttlSec })
}

/**
 * @returns {{ ok: true, data: object } | { ok: false, reason: 'expired' | 'invalid' }}
 */
export function decodeReviewInviteToken(token, secret) {
  try {
    const payload = jwt.verify(token, secret)
    if (!payload || payload[REVIEW_INVITE_FLAG] !== true) return { ok: false, reason: 'invalid' }
    const businessId = String(payload.bid || '')
    const bookingId = String(payload.bookingId || '')
    if (!businessId || !bookingId) return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      data: {
        businessId,
        bookingId,
        lang: typeof payload.lang === 'string' ? payload.lang.slice(0, 2) : 'en',
        customerName: typeof payload.customerName === 'string' ? payload.customerName : '',
        serviceName: typeof payload.serviceName === 'string' ? payload.serviceName : '',
        appointmentAt: typeof payload.appointmentAt === 'string' ? payload.appointmentAt : ''
      }
    }
  } catch (e) {
    const name = e && e.name
    if (name === 'TokenExpiredError') return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'invalid' }
  }
}

export function sanitizeReviewForPublic(r) {
  if (!r || typeof r !== 'object') return null
  return {
    id: String(r.id || r._id || ''),
    rating: Math.min(5, Math.max(1, Number(r.rating) || 0)),
    comment: typeof r.comment === 'string' ? r.comment.slice(0, 500) : '',
    customerName: typeof r.customerName === 'string' ? r.customerName.slice(0, 120) : 'Guest',
    serviceName: typeof r.serviceName === 'string' ? r.serviceName.slice(0, 200) : '',
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || '')
  }
}

export function aggregatePublishedReviews(rows, limit = 500) {
  const list = Array.isArray(rows) ? rows.map(sanitizeReviewForPublic).filter(Boolean) : []
  const published = list.filter((x) => x.rating > 0)
  const n = published.length
  if (n === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      reviews: []
    }
  }
  const sum = published.reduce((a, x) => a + x.rating, 0)
  const sorted = [...published].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0
    const tb = new Date(b.createdAt).getTime() || 0
    return tb - ta
  })
  return {
    averageRating: sum / n,
    totalReviews: n,
    reviews: sorted.slice(0, limit)
  }
}

export function newReviewDoc({
  businessId,
  bookingId,
  rating,
  comment,
  customerName,
  serviceName,
  appointmentAt,
  lang
}) {
  return {
    id: randomUUID(),
    businessId,
    bookingId,
    rating: Math.min(5, Math.max(1, Number(rating) || 1)),
    comment: typeof comment === 'string' ? comment.trim().slice(0, 500) : '',
    customerName: (customerName && String(customerName).trim().slice(0, 120)) || 'Guest',
    serviceName: (serviceName && String(serviceName).slice(0, 200)) || '',
    appointmentAt: appointmentAt ? new Date(appointmentAt) : null,
    status: 'published',
    lang: typeof lang === 'string' ? lang.slice(0, 2) : 'en',
    createdAt: new Date()
  }
}
