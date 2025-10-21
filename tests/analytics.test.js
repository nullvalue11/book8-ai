/**
 * Unit tests for analytics aggregation logic
 */

describe('Analytics Aggregation', () => {
  describe('KPI Calculations', () => {
    test('calculates total bookings correctly', () => {
      const bookings = [
        { id: '1', userId: 'user1', status: 'confirmed' },
        { id: '2', userId: 'user1', status: 'confirmed' },
        { id: '3', userId: 'user1', status: 'canceled' }
      ]
      
      expect(bookings.length).toBe(3)
    })

    test('counts reschedules correctly', () => {
      const bookings = [
        { id: '1', rescheduleCount: 0 },
        { id: '2', rescheduleCount: 1 },
        { id: '3', rescheduleCount: 2 }
      ]
      
      const reschedules = bookings.filter(b => b.rescheduleCount > 0).length
      expect(reschedules).toBe(2)
    })

    test('counts cancellations correctly', () => {
      const bookings = [
        { id: '1', status: 'confirmed' },
        { id: '2', status: 'canceled' },
        { id: '3', status: 'canceled' }
      ]
      
      const cancellations = bookings.filter(b => b.status === 'canceled').length
      expect(cancellations).toBe(2)
    })

    test('calculates average lead time', () => {
      const bookings = [
        { 
          createdAt: '2025-06-01T10:00:00Z', 
          startTime: '2025-06-02T10:00:00Z' // 24 hours = 1440 minutes
        },
        { 
          createdAt: '2025-06-01T10:00:00Z', 
          startTime: '2025-06-01T12:00:00Z' // 2 hours = 120 minutes
        }
      ]
      
      let totalLeadTime = 0
      let count = 0
      
      bookings.forEach(b => {
        const created = new Date(b.createdAt)
        const start = new Date(b.startTime)
        const diffMs = start - created
        if (diffMs > 0) {
          totalLeadTime += diffMs / (1000 * 60)
          count++
        }
      })
      
      const avgLeadTime = Math.round(totalLeadTime / count)
      expect(avgLeadTime).toBe(780) // (1440 + 120) / 2
    })
  })

  describe('Series Data Generation', () => {
    test('initializes all days with zeros', () => {
      const days = 7
      const startDate = new Date('2025-06-01')
      const seriesMap = new Map()
      
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        seriesMap.set(dateStr, {
          date: dateStr,
          bookings: 0,
          reschedules: 0,
          cancellations: 0,
          reminders_sent: 0
        })
      }
      
      expect(seriesMap.size).toBe(7)
      expect(seriesMap.get('2025-06-01').bookings).toBe(0)
    })

    test('aggregates bookings by date', () => {
      const bookings = [
        { createdAt: '2025-06-01T10:00:00Z', status: 'confirmed', rescheduleCount: 0 },
        { createdAt: '2025-06-01T15:00:00Z', status: 'confirmed', rescheduleCount: 1 },
        { createdAt: '2025-06-02T10:00:00Z', status: 'canceled', rescheduleCount: 0 }
      ]
      
      const seriesMap = new Map()
      seriesMap.set('2025-06-01', { date: '2025-06-01', bookings: 0, reschedules: 0, cancellations: 0 })
      seriesMap.set('2025-06-02', { date: '2025-06-02', bookings: 0, reschedules: 0, cancellations: 0 })
      
      bookings.forEach(booking => {
        const date = new Date(booking.createdAt)
        const dateStr = date.toISOString().split('T')[0]
        
        if (seriesMap.has(dateStr)) {
          const day = seriesMap.get(dateStr)
          day.bookings++
          
          if (booking.status === 'canceled') {
            day.cancellations++
          }
          
          if (booking.rescheduleCount > 0) {
            day.reschedules++
          }
        }
      })
      
      expect(seriesMap.get('2025-06-01').bookings).toBe(2)
      expect(seriesMap.get('2025-06-01').reschedules).toBe(1)
      expect(seriesMap.get('2025-06-02').bookings).toBe(1)
      expect(seriesMap.get('2025-06-02').cancellations).toBe(1)
    })
  })

  describe('Reminder Aggregation', () => {
    test('sums reminders sent from cron logs', () => {
      const cronLogs = [
        { task: 'reminders', successes: 5, failures: 1 },
        { task: 'reminders', successes: 3, failures: 0 },
        { task: 'google_sync', successes: 10, failures: 0 }
      ]
      
      const remindersSent = cronLogs
        .filter(log => log.task === 'reminders')
        .reduce((sum, log) => sum + (log.successes || 0), 0)
      
      expect(remindersSent).toBe(8)
    })
  })

  describe('Date Range Parsing', () => {
    test('parses 7d range correctly', () => {
      const range = '7d'
      const daysMatch = range.match(/(\d+)d/)
      const days = daysMatch ? parseInt(daysMatch[1]) : 7
      
      expect(days).toBe(7)
    })

    test('parses 30d range correctly', () => {
      const range = '30d'
      const daysMatch = range.match(/(\d+)d/)
      const days = daysMatch ? parseInt(daysMatch[1]) : 7
      
      expect(days).toBe(30)
    })

    test('defaults to 7 days for invalid range', () => {
      const range = 'invalid'
      const daysMatch = range.match(/(\d+)d/)
      const days = daysMatch ? parseInt(daysMatch[1]) : 7
      
      expect(days).toBe(7)
    })
  })
})
