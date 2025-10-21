/**
 * Email Rendering Utility
 * Renders React Email components to HTML strings for sending
 */

import { render } from '@react-email/components'

/**
 * Format datetime for display in emails
 */
function formatEmailDateTime(dateTime, timezone) {
  const date = new Date(dateTime)
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short'
  }
  return date.toLocaleString('en-US', options)
}

/**
 * Render 24-hour reminder email
 */
export async function renderReminder24h(booking, owner, guestTz = null) {
  const Reminder24h = (await import('../../emails/reminder-24h')).default
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const html = render(Reminder24h({
    bookingTitle: booking.title,
    hostName: owner.name || owner.email,
    guestName: booking.customer?.name || 'Guest',
    startTimeGuest: formatEmailDateTime(booking.startTime, displayTz),
    startTimeHost: formatEmailDateTime(booking.startTime, hostTz),
    guestTimeZone: displayTz,
    hostTimeZone: hostTz,
    manageLink: `${booking.baseUrl}/b/${owner.scheduling?.handle}/reschedule?token=${booking.rescheduleToken}`,
    showDualTz: guestTz && guestTz !== hostTz
  }))
  
  return html
}

/**
 * Render 1-hour reminder email
 */
export async function renderReminder1h(booking, owner, guestTz = null) {
  const Reminder1h = (await import('../../emails/reminder-1h')).default
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const html = render(Reminder1h({
    bookingTitle: booking.title,
    hostName: owner.name || owner.email,
    guestName: booking.customer?.name || 'Guest',
    startTimeGuest: formatEmailDateTime(booking.startTime, displayTz),
    startTimeHost: formatEmailDateTime(booking.startTime, hostTz),
    guestTimeZone: displayTz,
    hostTimeZone: hostTz,
    manageLink: `${booking.baseUrl}/b/${owner.scheduling?.handle}/reschedule?token=${booking.rescheduleToken}`,
    showDualTz: guestTz && guestTz !== hostTz
  }))
  
  return html
}

/**
 * Render host reschedule notification
 */
export async function renderHostReschedule(booking, owner, oldBooking, guestTz = null) {
  const HostReschedule = (await import('../../emails/host-reschedule')).default
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const html = render(HostReschedule({
    bookingTitle: booking.title,
    guestName: booking.customer?.name || 'Guest',
    guestEmail: booking.customer?.email || 'guest@example.com',
    oldTimeGuest: formatEmailDateTime(oldBooking.startTime, displayTz),
    oldTimeHost: formatEmailDateTime(oldBooking.startTime, hostTz),
    newTimeGuest: formatEmailDateTime(booking.startTime, displayTz),
    newTimeHost: formatEmailDateTime(booking.startTime, hostTz),
    guestTimeZone: displayTz,
    hostTimeZone: hostTz,
    manageLink: `${booking.baseUrl}/dashboard`,
    showDualTz: guestTz && guestTz !== hostTz
  }))
  
  return html
}

/**
 * Render host cancel notification
 */
export async function renderHostCancel(booking, owner, guestTz = null) {
  const HostCancel = (await import('../../emails/host-cancel')).default
  const hostTz = owner.scheduling?.timeZone || 'UTC'
  const displayTz = guestTz || booking.timeZone || 'UTC'
  
  const html = render(HostCancel({
    bookingTitle: booking.title,
    guestName: booking.customer?.name || 'Guest',
    guestEmail: booking.customer?.email || 'guest@example.com',
    timeGuest: formatEmailDateTime(booking.startTime, displayTz),
    timeHost: formatEmailDateTime(booking.startTime, hostTz),
    guestTimeZone: displayTz,
    hostTimeZone: hostTz,
    manageLink: `${booking.baseUrl}/dashboard`,
    showDualTz: guestTz && guestTz !== hostTz
  }))
  
  return html
}

/**
 * Get subject line for reminder
 */
export function getReminderSubject(type, bookingTitle) {
  if (type === '24h') {
    return `Reminder: ${bookingTitle} tomorrow`
  }
  return `Starting soon: ${bookingTitle}`
}
