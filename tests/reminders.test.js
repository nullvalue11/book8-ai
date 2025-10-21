/**
 * Unit tests for reminder helper functions
 */

const { 
  calculateReminders, 
  recomputeReminders, 
  getDueReminders, 
  markReminderSent 
} = require('../app/lib/reminders')

describe('Reminder Helpers', () => {
  describe('calculateReminders', () => {
    test('calculates both 24h and 1h reminders for future booking', () => {
      // 48 hours from now
      const startTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const reminders = calculateReminders(startTime)
      
      expect(reminders).toHaveLength(2)
      expect(reminders[0].type).toBe('24h')
      expect(reminders[1].type).toBe('1h')
      expect(reminders[0].sentAtUtc).toBeNull()
      expect(reminders[1].sentAtUtc).toBeNull()
    })

    test('only calculates 1h reminder for booking in 2 hours', () => {
      const startTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      const reminders = calculateReminders(startTime)
      
      expect(reminders).toHaveLength(1)
      expect(reminders[0].type).toBe('1h')
    })

    test('skips reminders for past bookings', () => {
      const startTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
      const reminders = calculateReminders(startTime)
      
      expect(reminders).toHaveLength(0)
    })

    test('skips reminders that would be in the past', () => {
      // 30 minutes from now (both reminders would be past)
      const startTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const reminders = calculateReminders(startTime)
      
      expect(reminders).toHaveLength(0)
    })
  })

  describe('recomputeReminders', () => {
    test('keeps already-sent reminders and creates new ones', () => {
      const existingReminders = [
        { id: '24h-sent', type: '24h', sentAtUtc: '2025-06-01T10:00:00Z', sendAtUtc: '2025-06-01T10:00:00Z' },
        { id: '1h-unsent', type: '1h', sentAtUtc: null, sendAtUtc: '2025-06-02T09:00:00Z' }
      ]
      
      // New time 48 hours from now
      const newStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const updated = recomputeReminders(existingReminders, newStartTime)
      
      // Should keep the sent 24h reminder
      const sent24h = updated.find(r => r.id === '24h-sent')
      expect(sent24h).toBeDefined()
      expect(sent24h.sentAtUtc).toBe('2025-06-01T10:00:00Z')
      
      // Should create a new 1h reminder (old one was unsent)
      const new1h = updated.find(r => r.type === '1h' && !r.sentAtUtc)
      expect(new1h).toBeDefined()
      expect(new1h.id).not.toBe('1h-unsent')
    })

    test('only creates reminders for types that were not sent', () => {
      const existingReminders = [
        { id: '24h-sent', type: '24h', sentAtUtc: '2025-06-01T10:00:00Z', sendAtUtc: '2025-06-01T10:00:00Z' },
        { id: '1h-sent', type: '1h', sentAtUtc: '2025-06-02T09:00:00Z', sendAtUtc: '2025-06-02T09:00:00Z' }
      ]
      
      const newStartTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const updated = recomputeReminders(existingReminders, newStartTime)
      
      // Should only keep the 2 sent reminders, no new ones
      expect(updated).toHaveLength(2)
      expect(updated.every(r => r.sentAtUtc)).toBe(true)
    })

    test('skips creating reminders that would be in the past', () => {
      const existingReminders = []
      
      // New time in 30 minutes (too soon for any reminders)
      const newStartTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const updated = recomputeReminders(existingReminders, newStartTime)
      
      expect(updated).toHaveLength(0)
    })
  })

  describe('getDueReminders', () => {
    test('returns reminders that are due and not sent', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 60 * 1000).toISOString() // 1 minute ago
      const future = new Date(now.getTime() + 60 * 1000).toISOString() // 1 minute from now
      
      const booking = {
        status: 'confirmed',
        reminders: [
          { id: 'due-1', type: '24h', sendAtUtc: past, sentAtUtc: null },
          { id: 'due-2', type: '1h', sendAtUtc: past, sentAtUtc: null },
          { id: 'future', type: '1h', sendAtUtc: future, sentAtUtc: null },
          { id: 'sent', type: '24h', sendAtUtc: past, sentAtUtc: past }
        ]
      }
      
      const due = getDueReminders(booking)
      
      expect(due).toHaveLength(2)
      expect(due.map(r => r.id)).toEqual(['due-1', 'due-2'])
    })

    test('returns empty array for canceled bookings', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 60 * 1000).toISOString()
      
      const booking = {
        status: 'canceled',
        reminders: [
          { id: 'due-1', type: '24h', sendAtUtc: past, sentAtUtc: null }
        ]
      }
      
      const due = getDueReminders(booking)
      expect(due).toHaveLength(0)
    })

    test('returns empty array if no reminders array', () => {
      const booking = {
        status: 'confirmed'
      }
      
      const due = getDueReminders(booking)
      expect(due).toHaveLength(0)
    })
  })

  describe('markReminderSent', () => {
    test('marks specific reminder as sent', () => {
      const reminders = [
        { id: 'reminder-1', type: '24h', sentAtUtc: null },
        { id: 'reminder-2', type: '1h', sentAtUtc: null }
      ]
      
      const updated = markReminderSent(reminders, 'reminder-1')
      
      expect(updated[0].sentAtUtc).toBeTruthy()
      expect(updated[1].sentAtUtc).toBeNull()
    })

    test('does not modify other reminders', () => {
      const reminders = [
        { id: 'reminder-1', type: '24h', sentAtUtc: null },
        { id: 'reminder-2', type: '1h', sentAtUtc: '2025-06-01T10:00:00Z' }
      ]
      
      const updated = markReminderSent(reminders, 'reminder-1')
      
      expect(updated[1].sentAtUtc).toBe('2025-06-01T10:00:00Z')
    })
  })
})
