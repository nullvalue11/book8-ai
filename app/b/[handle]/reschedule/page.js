"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Clock, Check, X, Loader2, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function ReschedulePage({ params }) {
  const handle = params.handle
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [state, setState] = useState('loading') // 'loading' | 'form' | 'success' | 'error'
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const [settings, setSettings] = useState(null)
  const [guestTz, setGuestTz] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (token) {
      verifyToken()
    } else {
      setState('error')
      setError('Missing reschedule token')
    }
  }, [token])

  useEffect(() => {
    if (date && guestTz && state === 'form') {
      loadSlots()
    }
  }, [date, guestTz, state])

  async function verifyToken() {
    try {
      const res = await fetch(`/api/bookings/reschedule?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 410) {
          if (data.error === 'used') {
            setError('This reschedule link has already been used')
          } else if (data.error === 'expired') {
            setError('This reschedule link has expired')
          } else {
            setError('This link is no longer valid. Ask the organizer for a new one.')
          }
        } else if (res.status === 403) {
          setError("This reschedule link isn't for this booking")
        } else {
          setError(data.error || 'Failed to verify reschedule link')
        }
        setState('error')
        return
      }
      
      setBooking(data.booking)
      setSettings(data.settings)
      
      // Initialize timezone and date
      const tz = data.booking.guestTimezone || data.settings.timezone || 'UTC'
      setGuestTz(tz)
      
      // Set default date to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setDate(tomorrow.toISOString().slice(0, 10))
      
      setState('form')
    } catch (err) {
      console.error('Verify token error:', err)
      setError('Failed to verify reschedule link')
      setState('error')
    }
  }

  async function loadSlots() {
    try {
      setLoadingSlots(true)
      setError('')
      setSelected(null)
      
      const res = await fetch(`/api/public/${encodeURIComponent(handle)}/availability?date=${date}&tz=${encodeURIComponent(guestTz)}&duration=${settings?.defaultDurationMin || 30}`)
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many requests. Please wait a moment.')
        } else {
          setError(data.error || 'Failed to load availability')
        }
        setSlots([])
        return
      }
      
      setSlots(data.slots || [])
    } catch (err) {
      console.error('Load slots error:', err)
      setError('Failed to load times')
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }

  async function handleReschedule() {
    if (!selected) {
      setError('Please select a new time')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      
      const res = await fetch('/api/bookings/reschedule/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newStart: selected.start,
          newEnd: selected.end
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 409) {
          setError('The selected time slot is not available. Please choose another.')
          await loadSlots()
        } else if (res.status === 410) {
          setError('This reschedule link has expired or been used')
        } else if (res.status === 429) {
          setError('Too many reschedule attempts. Please wait.')
        } else if (res.status === 400 && data.error?.includes('Maximum reschedule limit')) {
          setError('You\'ve reached the maximum number of reschedules for this meeting')
          setState('error')
        } else {
          setError(data.error || 'Failed to reschedule')
        }
        return
      }
      
      setState('success')
    } catch (err) {
      console.error('Reschedule error:', err)
      setError('Failed to reschedule. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: guestTz
    })
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: guestTz
    })
  }

  // Loading state
  if (state === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying reschedule link...</p>
        </div>
      </main>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Unable to Reschedule</h1>
              <p className="text-muted-foreground">{error}</p>
            </div>

            <Button onClick={() => window.location.href = '/'} variant="outline">
              Go to homepage
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Success state
  if (state === 'success') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full animate-fade-in">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center">
                <Check className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold">Rescheduled! 🎉</h1>
              <p className="text-muted-foreground">Updated invites have been sent to all participants</p>
            </div>

            {selected && (
              <div className="bg-muted/50 rounded-lg p-6 space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">New time</p>
                    <p className="font-medium">{formatDate(selected.start)}</p>
                    <p className="text-sm text-muted-foreground mt-1">All times in {guestTz}</p>
                  </div>
                </div>
                
                {booking?.currentStart && (
                  <div className="flex items-start gap-3 pt-3 border-t">
                    <div className="text-sm text-muted-foreground">
                      <p className="mb-1">Previous time</p>
                      <p className="line-through">{formatDate(booking.currentStart)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Up to 3 reschedules are allowed per booking
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Reschedule form
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-2xl font-semibold">Reschedule your meeting</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {booking?.title || 'Select a new time for your meeting'}
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Booking Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">Current booking</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">{formatDate(booking?.currentStart)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                      value={guestTz}
                      onChange={e => setGuestTz(e.target.value)}
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
                        onClick={() => setSelected(slot)}
                        className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          selected?.start === slot.start
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

          {/* Action Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Confirm reschedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selected && (
                  <div className="pt-2 pb-4 space-y-2">
                    <p className="text-sm font-medium">New time</p>
                    <p className="text-sm text-muted-foreground">{formatDate(selected.start)}</p>
                  </div>
                )}

                <Button 
                  onClick={handleReschedule}
                  disabled={!selected || submitting}
                  className="w-full gradient-primary text-white btn-glow"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rescheduling...
                    </>
                  ) : (
                    'Confirm reschedule'
                  )}
                </Button>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}

                <p className="text-xs text-muted-foreground text-center pt-2">
                  Up to 3 reschedules are allowed
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
