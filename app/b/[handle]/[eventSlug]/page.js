"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Textarea } from '../../../components/ui/textarea'
import { Calendar, Clock, Check, X, Loader2, AlertCircle, Download, CalendarPlus } from 'lucide-react'

export default function EventTypeBookingPage({ params }) {
  const { handle, eventSlug } = params
  
  const [guestTz, setGuestTz] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  const [state, setState] = useState('loading') // 'loading' | 'form' | 'success' | 'error'
  const [error, setError] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [bookingResult, setBookingResult] = useState(null)
  const [eventType, setEventType] = useState(null)

  // Initialize and load event type
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setGuestTz(detected)
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(tomorrow.toISOString().slice(0, 10))
    
    // Load event type info
    loadEventType()
  }, [])

  async function loadEventType() {
    try {
      const res = await fetch(
        `/api/public/event-type?handle=${encodeURIComponent(handle)}&slug=${encodeURIComponent(eventSlug)}`
      )
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        setError(data.error || 'Event type not found')
        setState('error')
        return
      }
      
      setEventType(data.eventType)
      setOwnerName(data.ownerName || handle)
      setState('form')
    } catch (err) {
      setError('Failed to load event type')
      setState('error')
    }
  }

  // Load slots when date or timezone changes
  useEffect(() => {
    if (date && guestTz && eventType) {
      loadSlots()
    }
  }, [date, guestTz, eventType])

  async function loadSlots() {
    try {
      setLoading(true)
      setError('')
      setSelected(null)
      
      const res = await fetch(
        `/api/public/availability?handle=${encodeURIComponent(handle)}&date=${date}&tz=${encodeURIComponent(guestTz)}&eventSlug=${encodeURIComponent(eventSlug)}`
      )
      
      const data = await res.json()
      
      if (!res.ok) {
        if (res.status === 404) {
          setError('Booking page not found. Please check the URL.')
          setState('error')
        } else {
          setError(data.error || 'Failed to load availability')
        }
        setSlots([])
        return
      }
      
      setSlots(data.slots || [])
      
    } catch (err) {
      setError('Failed to load availability')
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  async function handleBook() {
    if (!selected || !form.name || !form.email) {
      setError('Please fill in your name and email')
      return
    }
    
    try {
      setBooking(true)
      setError('')
      
      const res = await fetch(
        `/api/public/book?handle=${encodeURIComponent(handle)}&eventSlug=${encodeURIComponent(eventSlug)}`,
        {
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
        }
      )
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to book')
        return
      }
      
      setBookingResult(data)
      setState('success')
      
    } catch (err) {
      setError('Failed to book appointment')
    } finally {
      setBooking(false)
    }
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: guestTz
    })
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: guestTz
    })
  }

  // Loading state
  if (state === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Loading booking page...</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Error state
  if (state === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Success state
  if (state === 'success' && bookingResult) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-6">
              Your meeting with {ownerName} has been scheduled.
            </p>
            
            <div className="bg-muted rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold mb-3">{eventType?.name || 'Meeting'}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(bookingResult.booking?.startTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {formatTime(bookingResult.booking?.startTime)} - {formatTime(bookingResult.booking?.endTime)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              {bookingResult.booking?.id && (
                <Button
                  variant="outline"
                  onClick={() => {
                    window.open(
                      `/api/public/bookings/ics?bookingId=${bookingResult.booking.id}`,
                      '_blank'
                    )
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Calendar (.ics)
                </Button>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-6">
              A confirmation email has been sent to {form.email}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Booking form state
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted p-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span>Booking with {ownerName}</span>
            </div>
            <CardTitle className="text-2xl">{eventType?.name || 'Book a Meeting'}</CardTitle>
            {eventType?.description && (
              <p className="text-muted-foreground">{eventType.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <Clock className="h-4 w-4" />
              <span>{eventType?.durationMinutes || 30} minutes</span>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Date & Time Selection */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Select Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Available Times ({guestTz})</Label>
                  
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <X className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No available times on this date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {slots.map((slot, i) => (
                        <Button
                          key={i}
                          variant={selected?.start === slot.start ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelected(slot)}
                        >
                          {formatTime(slot.start)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right: Contact Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Your Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional information..."
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
                
                <Button
                  className="w-full"
                  onClick={handleBook}
                  disabled={!selected || !form.name || !form.email || booking}
                >
                  {booking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Booking...</>
                  ) : selected ? (
                    `Book ${formatTime(selected.start)}`
                  ) : (
                    'Select a time'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
