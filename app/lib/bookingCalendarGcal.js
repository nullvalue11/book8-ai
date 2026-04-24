/**
 * BOO-113 — Core-api bookings use `calendarEventId`; legacy book8-ai rows may use `googleEventId`.
 * Owner OAuth is on `users` linked via `business.ownerUserId`, not `booking.userId`.
 */

import { COLLECTION_NAME as BUSINESS_COLLECTION } from './schemas/business.js'

/** Prefer core-api field; fall back to legacy book8-ai field. */
export function getBookingCalendarEventId(booking) {
  if (!booking || typeof booking !== 'object') return null
  const a = booking.calendarEventId
  const b = booking.googleEventId
  const id = (a != null && String(a).trim()) || (b != null && String(b).trim())
  return id ? String(id).trim() : null
}

/** Same calendar resolution as internal gcal-create / gcal-update. */
export function resolveCalendarIdForUser(user) {
  const selected =
    Array.isArray(user?.scheduling?.selectedCalendarIds) && user.scheduling.selectedCalendarIds.length
      ? user.scheduling.selectedCalendarIds
      : Array.isArray(user?.google?.selectedCalendarIds) && user.google.selectedCalendarIds.length
        ? user.google.selectedCalendarIds
        : ['primary']
  return selected[0] || 'primary'
}

/**
 * Host user for emails / OAuth: business owner when `businessId` is set, else legacy `booking.userId`.
 * @returns {{ user: import('mongodb').WithId<object> | null, business: object | null }}
 */
export async function resolveHostUserForBooking(database, booking) {
  const bid = booking?.businessId
  if (bid) {
    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [{ businessId: String(bid) }, { id: String(bid) }]
    })
    if (business?.ownerUserId) {
      const user = await database.collection('users').findOne({ id: business.ownerUserId })
      if (user) return { user, business }
    }
  }
  if (booking?.userId) {
    const user = await database.collection('users').findOne({ id: booking.userId })
    if (user) return { user, business: null }
  }
  return { user: null, business: null }
}

/** True when Google Calendar / OAuth indicates a revoked or invalid refresh token. */
export function isInvalidGrantGoogleError(err) {
  if (!err || typeof err !== 'object') return false
  return (
    String(err.message || '').includes('invalid_grant') ||
    err.code === 401 ||
    err.response?.status === 401
  )
}

/**
 * Persist reconnect hint on the owner when Google rejects the token (e.g. invalid_grant).
 * @param {import('mongodb').Db} database
 * @param {string} ownerUserId
 */
export async function markUserGoogleNeedsReconnect(database, ownerUserId) {
  await database.collection('users').updateOne(
    { id: ownerUserId },
    {
      $set: {
        'google.needsReconnect': true,
        'google.lastError': new Date().toISOString()
      }
    }
  )
}

/**
 * Delete a Google Calendar event for a business (owner OAuth). Resilient: never throws to caller.
 * @returns {Promise<{ ok: boolean, deleted: boolean, reason?: string }>}
 */
export async function deleteGoogleCalendarEventForBusiness(database, env, { businessId, eventId, logPrefix = '[gcal-delete]' }) {
  if (!eventId || !businessId) {
    console.info(`${logPrefix} missing eventId or businessId — skip`)
    return { ok: true, deleted: false, reason: 'missing_params' }
  }

  const bizId = String(businessId).trim()
  const business = await database.collection(BUSINESS_COLLECTION).findOne({
    $or: [{ businessId: bizId }, { id: bizId }]
  })
  if (!business?.ownerUserId) {
    console.warn(`${logPrefix} No business or ownerUserId for businessId=`, bizId)
    return { ok: true, deleted: false, reason: 'no_owner' }
  }

  const user = await database.collection('users').findOne({ id: business.ownerUserId })
  const google = user?.google || {}
  if (!google.refreshToken || google.connected !== true) {
    console.info(`${logPrefix} Owner has no Google connection — skip`, eventId)
    return { ok: true, deleted: false, reason: 'no_google_token' }
  }
  if (google.needsReconnect === true) {
    console.info(`${logPrefix} Owner needs Google reconnect — skip`, eventId)
    return { ok: true, deleted: false, reason: 'needs_reconnect' }
  }

  const calendarId = resolveCalendarIdForUser(user)

  try {
    const { google: gapi } = await import('googleapis')
    const oauth = new gapi.auth.OAuth2(
      env.GOOGLE?.CLIENT_ID,
      env.GOOGLE?.CLIENT_SECRET,
      env.GOOGLE?.REDIRECT_URI
    )
    oauth.setCredentials({ refresh_token: google.refreshToken })
    const calendar = gapi.calendar({ version: 'v3', auth: oauth })
    await calendar.events.delete({ calendarId, eventId: String(eventId).trim() })
    console.log(`${logPrefix} Google event deleted:`, eventId, 'from', calendarId)
    return { ok: true, deleted: true }
  } catch (err) {
    console.error(`${logPrefix} Google delete failed:`, err?.message || err)
    if (isInvalidGrantGoogleError(err)) {
      try {
        await markUserGoogleNeedsReconnect(database, business.ownerUserId)
      } catch {
        /* ignore */
      }
    }
    return { ok: true, deleted: false, reason: 'google_error' }
  }
}
