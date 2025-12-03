/**
 * Reminder Helper Functions
 * Handles reminder calculation and management for bookings
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * Calculate reminder times for a booking
 * @param {string} startTime - ISO datetime string
 * @param {Object} options - Optional configuration
 * @param {boolean} options.enabled24h - Whether to include 24h reminder (default true)
 * @param {boolean} options.enabled1h - Whether to include 1h reminder (default true)
 * @returns {Array} Array of reminder objects (only future reminders)
 */
export function calculateReminders(startTime, options = {}) {
  const { enabled24h = true, enabled1h = true } = options
  const reminders = []
  const now = new Date()
  const start = new Date(startTime)
  
  // 24 hour reminder (if enabled)
  if (enabled24h) {
    const reminder24h = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    if (reminder24h > now) {
      reminders.push({
        id: uuidv4(),
        type: '24h',
        sendAtUtc: reminder24h.toISOString(),
        sentAtUtc: null
      })
    }
  }
  
  // 1 hour reminder (if enabled)
  if (enabled1h) {
    const reminder1h = new Date(start.getTime() - 60 * 60 * 1000)
    if (reminder1h > now) {
      reminders.push({
        id: uuidv4(),
        type: '1h',
        sendAtUtc: reminder1h.toISOString(),
        sentAtUtc: null
      })
    }
  }
  
  return reminders
}

/**
 * Recompute reminders for a rescheduled booking
 * Keeps already-sent reminders, recomputes pending ones
 * @param {Array} existingReminders - Current reminders array
 * @param {string} newStartTime - New ISO datetime string
 * @returns {Array} Updated reminders array
 */
export function recomputeReminders(existingReminders, newStartTime) {
  const now = new Date()
  const newStart = new Date(newStartTime)
  
  // Keep reminders that were already sent
  const sentReminders = existingReminders.filter(r => r.sentAtUtc)
  
  // Calculate new reminders for unsent types
  const unsentTypes = new Set(['24h', '1h'])
  sentReminders.forEach(r => unsentTypes.delete(r.type))
  
  const newReminders = []
  
  unsentTypes.forEach(type => {
    const hoursOffset = type === '24h' ? 24 : 1
    const reminderTime = new Date(newStart.getTime() - hoursOffset * 60 * 60 * 1000)
    
    if (reminderTime > now) {
      newReminders.push({
        id: uuidv4(),
        type,
        sendAtUtc: reminderTime.toISOString(),
        sentAtUtc: null
      })
    }
  })
  
  return [...sentReminders, ...newReminders]
}

/**
 * Get due reminders from a booking
 * @param {Object} booking - Booking document with reminders
 * @returns {Array} Array of due reminders
 */
export function getDueReminders(booking) {
  if (!booking.reminders || booking.status !== 'confirmed') {
    return []
  }
  
  const now = new Date()
  
  return booking.reminders.filter(reminder => {
    // Must not have been sent yet
    if (reminder.sentAtUtc) return false
    
    // Must be due (sendAtUtc <= now)
    const sendAt = new Date(reminder.sendAtUtc)
    return sendAt <= now
  })
}

/**
 * Mark a reminder as sent
 * @param {Array} reminders - Current reminders array
 * @param {string} reminderId - ID of the reminder to mark
 * @returns {Array} Updated reminders array
 */
export function markReminderSent(reminders, reminderId) {
  return reminders.map(r => {
    if (r.id === reminderId) {
      return { ...r, sentAtUtc: new Date().toISOString() }
    }
    return r
  })
}
