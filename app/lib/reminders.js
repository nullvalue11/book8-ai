/**
 * Reminder Helper Functions
 * Handles reminder calculation and management for bookings
 * Supports both guest and host reminders with configurable settings
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * Default reminder settings structure
 */
export const DEFAULT_REMINDER_SETTINGS = {
  enabled: true,
  guestEnabled: true,
  hostEnabled: false,
  types: { '24h': true, '1h': true }
}

/**
 * Calculate reminder times for a booking
 * @param {string} startTime - ISO datetime string
 * @param {Object} settings - Reminder settings from owner's scheduling config
 * @param {boolean} settings.enabled - Master switch for reminders
 * @param {boolean} settings.guestEnabled - Whether to send guest reminders
 * @param {boolean} settings.hostEnabled - Whether to send host reminders
 * @param {Object} settings.types - Which reminder types are enabled { '24h': boolean, '1h': boolean }
 * @returns {Array} Array of reminder objects (only future reminders)
 */
export function calculateReminders(startTime, settings = {}) {
  // Merge with defaults
  const config = {
    enabled: settings.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    guestEnabled: settings.guestEnabled ?? DEFAULT_REMINDER_SETTINGS.guestEnabled,
    hostEnabled: settings.hostEnabled ?? DEFAULT_REMINDER_SETTINGS.hostEnabled,
    types: {
      '24h': settings.types?.['24h'] ?? DEFAULT_REMINDER_SETTINGS.types['24h'],
      '1h': settings.types?.['1h'] ?? DEFAULT_REMINDER_SETTINGS.types['1h']
    }
  }
  
  // If reminders are completely disabled, return empty array
  if (!config.enabled) {
    return []
  }
  
  // If neither guest nor host reminders are enabled, return empty
  if (!config.guestEnabled && !config.hostEnabled) {
    return []
  }
  
  const reminders = []
  const now = new Date()
  const start = new Date(startTime)
  
  // Helper to add reminders for a specific audience
  const addRemindersForAudience = (audience) => {
    // 24 hour reminder (if enabled)
    if (config.types['24h']) {
      const reminder24h = new Date(start.getTime() - 24 * 60 * 60 * 1000)
      if (reminder24h > now) {
        reminders.push({
          id: uuidv4(),
          type: '24h',
          audience,
          sendAtUtc: reminder24h.toISOString(),
          sentAtUtc: null
        })
      }
    }
    
    // 1 hour reminder (if enabled)
    if (config.types['1h']) {
      const reminder1h = new Date(start.getTime() - 60 * 60 * 1000)
      if (reminder1h > now) {
        reminders.push({
          id: uuidv4(),
          type: '1h',
          audience,
          sendAtUtc: reminder1h.toISOString(),
          sentAtUtc: null
        })
      }
    }
  }
  
  // Add guest reminders if enabled
  if (config.guestEnabled) {
    addRemindersForAudience('guest')
  }
  
  // Add host reminders if enabled
  if (config.hostEnabled) {
    addRemindersForAudience('host')
  }
  
  return reminders
}

/**
 * Recompute reminders for a rescheduled booking
 * Keeps already-sent reminders, recomputes pending ones
 * Handles both guest and host reminders
 * @param {Array} existingReminders - Current reminders array
 * @param {string} newStartTime - New ISO datetime string
 * @param {Object} settings - Reminder settings from owner's scheduling config
 * @returns {Array} Updated reminders array
 */
export function recomputeReminders(existingReminders, newStartTime, settings = {}) {
  const config = {
    enabled: settings.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    guestEnabled: settings.guestEnabled ?? DEFAULT_REMINDER_SETTINGS.guestEnabled,
    hostEnabled: settings.hostEnabled ?? DEFAULT_REMINDER_SETTINGS.hostEnabled,
    types: {
      '24h': settings.types?.['24h'] ?? DEFAULT_REMINDER_SETTINGS.types['24h'],
      '1h': settings.types?.['1h'] ?? DEFAULT_REMINDER_SETTINGS.types['1h']
    }
  }
  
  // If reminders are disabled, clear all unsent reminders
  if (!config.enabled) {
    return existingReminders.filter(r => r.sentAtUtc)
  }
  
  const now = new Date()
  const newStart = new Date(newStartTime)
  
  // Keep reminders that were already sent
  const sentReminders = existingReminders.filter(r => r.sentAtUtc)
  
  // Track which type+audience combinations have been sent
  const sentCombos = new Set()
  sentReminders.forEach(r => {
    const audience = r.audience || 'guest' // Legacy reminders default to guest
    sentCombos.add(`${r.type}-${audience}`)
  })
  
  const newReminders = []
  
  // Helper to add new reminders for a type and audience
  const addIfNeeded = (type, audience) => {
    const combo = `${type}-${audience}`
    if (sentCombos.has(combo)) return // Already sent
    
    const hoursOffset = type === '24h' ? 24 : 1
    const reminderTime = new Date(newStart.getTime() - hoursOffset * 60 * 60 * 1000)
    
    if (reminderTime > now) {
      newReminders.push({
        id: uuidv4(),
        type,
        audience,
        sendAtUtc: reminderTime.toISOString(),
        sentAtUtc: null
      })
    }
  }
  
  // Process guest reminders
  if (config.guestEnabled) {
    if (config.types['24h']) addIfNeeded('24h', 'guest')
    if (config.types['1h']) addIfNeeded('1h', 'guest')
  }
  
  // Process host reminders
  if (config.hostEnabled) {
    if (config.types['24h']) addIfNeeded('24h', 'host')
    if (config.types['1h']) addIfNeeded('1h', 'host')
  }
  
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

/**
 * Normalize legacy reminder settings to new format
 * @param {Object} reminders - Raw reminder settings from DB
 * @returns {Object} Normalized reminder settings
 */
export function normalizeReminderSettings(reminders) {
  if (!reminders) return DEFAULT_REMINDER_SETTINGS
  
  // Handle legacy format: { enabled24h: boolean, enabled1h: boolean }
  if ('enabled24h' in reminders || 'enabled1h' in reminders) {
    return {
      enabled: true,
      guestEnabled: true,
      hostEnabled: false,
      types: {
        '24h': reminders.enabled24h !== false,
        '1h': reminders.enabled1h !== false
      }
    }
  }
  
  // New format - merge with defaults
  return {
    enabled: reminders.enabled ?? DEFAULT_REMINDER_SETTINGS.enabled,
    guestEnabled: reminders.guestEnabled ?? DEFAULT_REMINDER_SETTINGS.guestEnabled,
    hostEnabled: reminders.hostEnabled ?? DEFAULT_REMINDER_SETTINGS.hostEnabled,
    types: {
      '24h': reminders.types?.['24h'] ?? DEFAULT_REMINDER_SETTINGS.types['24h'],
      '1h': reminders.types?.['1h'] ?? DEFAULT_REMINDER_SETTINGS.types['1h']
    }
  }
}
