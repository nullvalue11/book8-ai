"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar, Clock, Check, X, Loader2 } from 'lucide-react'

export default function PublicBookingPage({ params }) {
  const handle = params.handle
  
  // Auto-detect timezone
  const [guestTz, setGuestTz] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  const [state, setState] = useState('form') // 'form' | 'success' | 'error'
  const [error, setError] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [bookingResult, setBookingResult] = useState(null)

  // Initialize
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setGuestTz(detected)
    
    // Set default date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(tomorrow.toISOString().slice(0, 10))
  }, [])

  // Load slots when date or timezone changes
  useEffect(() => {
    if (date && guestTz) {
      loadSlots()
    }
  }, [date, guestTz])

  async function loadSlots() {
    try {
      setLoading(true)
      setError('')
      setSelected(null)
      
      const res = await fetch(`/api/public/${encodeURIComponent(handle)}/availability?date=${date}&tz=${encodeURIComponent(guestTz)}`)
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 404) {
          if (data.error?.includes('not configured')) {
            setError('⚙️ This booking page is being set up. Please check back later or contact the owner.')
            setState('error')
          } else {
            setError('Booking page not found')
            setState('error')
          }
        } else if (res.status === 429) {
          setError('Too many requests. Please wait a moment and try again.')
        } else {
          setError(data.error || 'Failed to load availability')
        }
        setSlots([])
        return
      }
      
      setSlots(data.slots || [])
      if (data.slots && data.slots.length > 0 && ownerName === '') {
        // Try to get owner name from somewhere if available
        setOwnerName(handle)
      }
    } catch (err) {
      console.error('Load slots error:', err)
      setError('Failed to connect. Please try again.')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  async function handleBooking() {
    if (!selected) {
      setError('Please select a time slot')
      return
    }
    
    if (!form.name || !form.email) {
      setError('Please fill in your name and email')
      return
    }

    try {
      setBooking(true)
      setError('')
      
      const res = await fetch(`/api/public/${encodeURIComponent(handle)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          notes: form.notes,
          start: selected.start,
          end: selected.end,
          guestTimezone: guestTz
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 409) {
          setError('Sorry, that slot was just taken. Please pick another.')
          await loadSlots() // Refresh slots
        } else if (res.status === 429) {
          setError('Too many booking attempts. Please wait a moment.')
        } else {
          setError(data.error || 'Booking failed. Please try again.')
        }
        return
      }
      
      setBookingResult(data)
      setState('success')
    } catch (err) {
      console.error('Booking error:', err)
      setError('Failed to complete booking. Please try again.')
    } finally {
      setBooking(false)
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

  // Error screen (not configured)
  if (state === 'error') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Booking Page Setup Required</h1>
              <p className="text-muted-foreground">{error}</p>
            </div>

            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Success screen
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
              <h1 className="text-3xl font-semibold">You're booked! 🎉</h1>
              <p className="text-muted-foreground">A confirmation email is on its way to {form.email}</p>
            </div>

            {selected && (
              <div className="bg-muted/50 rounded-lg p-6 space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">{formatDate(selected.start)}</p>
                    <p className="text-sm text-muted-foreground">All times in {guestTz}</p>
                  </div>
                </div>
                
                {form.notes && (
                  <div className="flex items-start gap-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{form.notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="pt-4">
              <Button onClick={() => window.location.reload()} variant="outline">
                Book another time
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Main booking form
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-2xl font-semibold">Book time with {ownerName || handle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All times shown in <span className="font-medium">{guestTz}</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Date & Time Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Picker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Select a date
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
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="text-center py-12 space-y-2">
                    <X className="w-8 h-8 text-destructive mx-auto" />
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-muted-foreground">No times available for this day</p>
                    <p className="text-sm text-muted-foreground">Try another date or timezone</p>
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

          {/* Booking Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Your details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input 
                    id="name"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="book8-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="book8-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea 
                    id="notes"
                    placeholder="Anything you'd like to share..."
                    value={form.notes}
                    onChange={e => setForm({...form, notes: e.target.value})}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                {selected && (
                  <div className="pt-4 border-t space-y-2">
                    <p className="text-sm font-medium">Selected time</p>
                    <p className="text-sm text-muted-foreground">{formatDate(selected.start)}</p>
                  </div>
                )}

                <Button 
                  onClick={handleBooking}
                  disabled={!selected || booking || !form.name || !form.email}
                  className="w-full gradient-primary text-white btn-glow"
                >
                  {booking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    'Book meeting'
                  )}
                </Button>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
