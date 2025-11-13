"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Loader2, AlertCircle, CheckCircle, XCircle, Calendar, Clock, RefreshCw } from 'lucide-react'

export default function RescheduleBookingPage({ params }) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('loading') // 'loading' | 'select' | 'success' | 'error'
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const [rescheduling, setRescheduling] = useState(false)
  const token = params.token

  // Reschedule form
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [timezone, setTimezone] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    // Fetch booking details
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/public/bookings/reschedule/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Invalid or expired reschedule link')
          setStatus('error')
          return
        }

        setBooking(data.booking)
        setHandle(data.handle)
        setTimezone(data.booking.guestTimezone || data.booking.timeZone || 'UTC')
        
        // Set default date to tomorrow
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setDate(tomorrow.toISOString().slice(0, 10))
        
        setStatus('select')
      } catch (err) {
        console.error('Fetch booking error:', err)
        setError('Failed to load booking details. Please try again.')
        setStatus('error')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchBooking()
    } else {
      setError('Invalid reschedule link')
      setStatus('error')
      setLoading(false)
    }
  }, [token])

  // Load available slots when date or timezone changes
  useEffect(() => {
    if (status === 'select' && date && timezone && handle) {
      loadAvailableSlots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, timezone, status])

  async function loadAvailableSlots() {
    try {
      setLoadingSlots(true)
      setError('')
      setSelectedSlot(null)

      const res = await fetch(
        `/api/public/${encodeURIComponent(handle)}/availability?date=${date}&tz=${encodeURIComponent(timezone)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load available times')
        setSlots([])
        return
      }

      setSlots(data.slots || [])
    } catch (err) {
      console.error('Load slots error:', err)
      setError('Failed to load available times. Please try again.')
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) {
      setError('Please select a new time slot')
      return
    }

    try {
      setRescheduling(true)
      setError('')

      const res = await fetch(`/api/public/bookings/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newStart: selectedSlot.start,
          newEnd: selectedSlot.end,
          timezone
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('That time slot is no longer available. Please select another.')
          await loadAvailableSlots()
        } else {
          setError(data.error || 'Failed to reschedule. Please try again.')
        }
        return
      }

      setStatus('success')
    } catch (err) {
      console.error('Reschedule error:', err)
      setError('Failed to reschedule. Please try again.')
    } finally {
      setRescheduling(false)
    }
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    })
  }

  function formatDateTime(isoString) {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone
    })
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading booking details...</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Unable to Reschedule</h1>
              <p className="text-muted-foreground">{error}</p>
            </div>

            <Button onClick={() => window.location.href = '/'} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Success state
  if (status === 'success') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Meeting Rescheduled!</h1>
              <p className="text-muted-foreground">
                Your meeting has been successfully rescheduled.
              </p>
              {selectedSlot && (
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <p className="font-medium">{formatDateTime(selectedSlot.start)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{timezone}</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                A confirmation email has been sent with the new meeting details.
              </p>
            </div>

            <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Reschedule selection state
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <RefreshCw className="w-6 h-6" />
            Reschedule Your Meeting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a new time for your meeting
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Meeting Info */}
          <div className="lg:col-span-3">
            {booking && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Meeting</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{booking.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDateTime(booking.startTime)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Date & Time Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Picker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Select a new date
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="book8-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Your timezone</Label>
                    <select
                      id="timezone"
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    >
                      {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'UTC'].map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Slots */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Available times
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : error && slots.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <XCircle className="w-8 h-8 text-destructive mx-auto" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-muted-foreground">No times available for this day</p>
                    <p className="text-sm text-muted-foreground">Try another date</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.start}
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          selectedSlot?.start === slot.start
                            ? 'gradient-primary text-white border-transparent'
                            : 'border-border hover:border-primary bg-card'
                        }`}
                      >
                        {formatTime(slot.start)}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Confirm Reschedule */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Confirm new time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedSlot ? (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">Selected time:</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(selectedSlot.start)}
                    </p>
                    <p className="text-xs text-muted-foreground">{timezone}</p>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Select a time slot to continue
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleReschedule}
                  disabled={!selectedSlot || rescheduling}
                  className="w-full gradient-primary text-white btn-glow"
                >
                  {rescheduling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rescheduling...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Confirm Reschedule
                    </>
                  )}
                </Button>

                {error && slots.length > 0 && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <Button
                  onClick={() => window.location.href = '/'}
                  variant="ghost"
                  className="w-full"
                  disabled={rescheduling}
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
