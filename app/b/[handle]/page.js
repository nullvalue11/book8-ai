"use client"
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react'

export default function PublicBookingPage({ params }) {
  const handle = params.handle

  const [guestTz, setGuestTz] = useState('')
  const [currentMonth, setCurrentMonth] = useState(null)
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [selected, setSelected] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [state, setState] = useState('form')
  const [error, setError] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [businessMeta, setBusinessMeta] = useState({ category: '', city: '' })
  const [bookingResult, setBookingResult] = useState(null)
  const [hasServices, setHasServices] = useState(false)

  // Detect timezone
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setGuestTz(detected)
  }, [])

  // Load services (deduplicated by name)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/public/services?handle=${encodeURIComponent(handle)}`)
        const data = await res.json()
        if (!cancelled && res.ok && Array.isArray(data?.services) && data.services.length > 0) {
          const seen = new Set()
          const deduped = data.services.filter((s) => {
            const key = (s.name || '').trim().toLowerCase()
            if (!key || seen.has(key)) return false
            seen.add(key)
            return true
          })
          setServices(deduped)
          setHasServices(deduped.length > 0)
          if (deduped.length > 0 && !selectedService) {
            setSelectedService(deduped[0])
          }
        }
      } catch (e) {
        if (!cancelled) console.error('Load services:', e)
      } finally {
        if (!cancelled) setServicesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedService intentionally omitted to avoid loop
  }, [handle])

  // Auto-select first service when services load
  useEffect(() => {
    if (services.length > 0 && !selectedService) {
      setSelectedService(services[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit selectedService to avoid loop
  }, [services])

  // Initialize date to today
  useEffect(() => {
    const now = new Date()
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() })
    setDate(now.toISOString().slice(0, 10))
  }, [])

  const loadSlots = useCallback(async () => {
    if (!date || !guestTz) return
    const duration = selectedService?.durationMinutes || selectedService?.duration || 30
    if (hasServices && !selectedService) return

    try {
      setLoading(true)
      setError('')
      setSelected(null)
      const url = `/api/public/availability?handle=${encodeURIComponent(handle)}&date=${date}&tz=${encodeURIComponent(guestTz)}&duration=${duration}`
      const res = await fetch(url)

      if (!res) {
        setError('Failed to connect. Please check your internet connection.')
        setSlots([])
        return
      }

      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'GOOGLE_INVALID_GRANT') {
          setError(data.hint || 'Calendar needs to be reconnected.')
          setState('error')
        } else if (res.status === 404) {
          if (data.error?.includes('not configured')) {
            setError('This booking page is being set up. Please check back later.')
            setState('error')
          } else {
            setError('Booking page not found.')
            setState('error')
          }
        } else if (res.status === 429) {
          setError('Too many requests. Please wait a moment.')
        } else {
          setError(data.error || 'Failed to load availability.')
        }
        setSlots([])
        return
      }

      setSlots(data.slots || [])
      if (data.ownerName) setOwnerName(data.ownerName)
      else if (ownerName === '') setOwnerName(handle)

      // Auto-select today or next available: if no slots for today, try tomorrow
      if (!date && data.slots?.length === 0) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setDate(tomorrow.toISOString().slice(0, 10))
      }
    } catch (err) {
      console.error('Load slots error:', err)
      setError('Unable to connect. Please try again.')
      setSlots([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ownerName used for fallback only
  }, [handle, date, guestTz, hasServices, selectedService])

  // Fetch slots when date, tz, and service are ready
  useEffect(() => {
    if (date && guestTz && (!hasServices || selectedService)) {
      loadSlots()
    }
  }, [date, guestTz, hasServices, selectedService, loadSlots])

  // Auto-select first available date when today has no slots (run after loadSlots)
  useEffect(() => {
    if (loading === false && slots.length === 0 && date) {
      const todayStr = new Date().toISOString().slice(0, 10)
      if (date === todayStr) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const nextStr = tomorrow.toISOString().slice(0, 10)
        setDate(nextStr)
        setCurrentMonth({ year: tomorrow.getFullYear(), month: tomorrow.getMonth() })
      }
    }
  }, [loading, slots.length, date])

  async function handleBooking() {
    if (!selected) {
      setError('Please select a time slot')
      return
    }
    if (!form.name?.trim()) {
      setError('Please enter your name')
      return
    }
    if (!form.email?.trim()?.includes('@')) {
      setError('Please enter your email')
      return
    }

    try {
      setBooking(true)
      setError('')

      const e = (form.email || '').trim()
      const p = (form.phone || '').trim()
      if (!e || !e.includes('@')) {
        setError('Email is required for confirmation')
        setBooking(false)
        return
      }

      const res = await fetch(`/api/public/book?handle=${encodeURIComponent(handle)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: e,
          phone: p || undefined,
          notes: form.notes || undefined,
          start: selected.start,
          end: selected.end,
          guestTimezone: guestTz,
          serviceId: selectedService?.serviceId || selectedService?.id
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError('That slot was just taken. Please pick another.')
          loadSlots()
        } else if (res.status === 429) {
          setError('Too many attempts. Please wait a moment.')
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

  const canSubmit =
    selected &&
    form.name?.trim() &&
    form.email?.trim()?.includes('@') &&
    (!hasServices || selectedService) &&
    !booking

  // --- Calendar helpers ---
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const calendarDays = useMemo(() => {
    if (!currentMonth) return []
    const { year, month } = currentMonth
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [currentMonth])

  const todayStr = new Date().toISOString().slice(0, 10)

  function goPrevMonth() {
    if (!currentMonth) return
    const d = new Date(currentMonth.year, currentMonth.month - 1, 1)
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  function goNextMonth() {
    if (!currentMonth) return
    const d = new Date(currentMonth.year, currentMonth.month + 1, 1)
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  function onDateClick(d) {
    if (!d) return
    const dStr = d.toISOString().slice(0, 10)
    if (dStr < todayStr) return
    setDate(dStr)
  }

  // --- Error screen ---
  if (state === 'error') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">Setup Required</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
        </div>
      </main>
    )
  }

  // --- Success screen ---
  if (state === 'success') {
    const icsDownloadUrl =
      bookingResult?.bookingId && form.email
        ? `/api/public/bookings/ics?bookingId=${bookingResult.bookingId}&email=${encodeURIComponent(form.email)}`
        : null
    const cancelUrl = bookingResult?.cancelToken ? `/bookings/cancel/${bookingResult.cancelToken}` : null
    const rescheduleUrl = bookingResult?.rescheduleToken ? `/bookings/reschedule/${bookingResult.rescheduleToken}` : null
    const contactDisplay = form.email || form.phone || ''

    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">You&apos;re booked! ✓</h1>
            {selectedService && (
              <p className="text-muted-foreground font-medium">
                {selectedService.name} • {selected && formatTime(selected.start)}
              </p>
            )}
            {selected && (
              <p className="text-sm text-muted-foreground">
                {formatDate(selected.start)}
              </p>
            )}
            {contactDisplay && (
              <p className="text-sm text-muted-foreground">
                Confirmation sent to {contactDisplay}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {icsDownloadUrl && (
              <Button
                onClick={() => window.open(icsDownloadUrl, '_blank')}
                className="w-full gradient-primary text-white h-12"
                size="lg"
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Add to Calendar
              </Button>
            )}
            <div className="flex gap-3">
              {rescheduleUrl && (
                <Button onClick={() => (window.location.href = rescheduleUrl)} variant="outline" className="flex-1">
                  Reschedule
                </Button>
              )}
              {cancelUrl && (
                <Button onClick={() => (window.location.href = cancelUrl)} variant="outline" className="flex-1 text-destructive hover:text-destructive">
                  Cancel
                </Button>
              )}
            </div>
            <Button onClick={() => window.location.reload()} variant="ghost" className="w-full">
              Book another time
            </Button>
          </div>
          {bookingResult?.bookingId && (
            <p className="text-xs text-muted-foreground text-center">
              Booking ID: <span className="font-mono">{bookingResult.bookingId}</span>
            </p>
          )}
        </div>
      </main>
    )
  }

  // --- Main booking flow ---
  const effectiveService = hasServices ? selectedService : { name: 'Appointment', durationMinutes: 30, duration: 30 }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-4 md:px-6">
        <div className="max-w-[900px] mx-auto">
          <h1 className="text-2xl font-bold">{ownerName || handle}</h1>
          {(businessMeta.category || businessMeta.city) && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">
              {[businessMeta.category, businessMeta.city].filter(Boolean).join(' • ')}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Services, Calendar, Slots */}
          <div className="lg:col-span-3 space-y-6">
            {/* Service pills */}
            {hasServices && (
              <section>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Service</p>
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory md:flex-wrap">
                    {services.map((svc) => {
                      const isSelected =
                        (selectedService?.serviceId && selectedService.serviceId === svc.serviceId) ||
                        (selectedService?.id && selectedService.id === svc.id) ||
                        selectedService?.name === svc.name
                      return (
                        <button
                          key={svc.serviceId || svc.id || svc.name}
                          onClick={() => setSelectedService(svc)}
                          className={`
                            shrink-0 snap-start px-4 py-2.5 rounded-full text-sm font-medium
                            transition-all duration-150 ease-out cursor-pointer
                            hover:scale-[1.02]
                            ${isSelected
                              ? 'bg-primary text-primary-foreground border-2 border-primary'
                              : 'border-2 border-border bg-card hover:border-primary/50'
                            }
                          `}
                        >
                          {svc.name} • {svc.durationMinutes || svc.duration || 30} min
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Calendar */}
            {(!hasServices || selectedService) && (
              <section>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Date</p>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={goPrevMonth}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium">
                      {currentMonth && monthNames[currentMonth.month]} {currentMonth?.year}
                    </span>
                    <button
                      onClick={goNextMonth}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {dayHeaders.map((h) => (
                      <div key={h} className="text-xs text-muted-foreground py-1">
                        {h}
                      </div>
                    ))}
                    {calendarDays.map((d, i) => {
                      if (!d) return <div key={`pad-${i}`} className="aspect-square" />
                      const dStr = d.toISOString().slice(0, 10)
                      const isPast = dStr < todayStr
                      const isToday = dStr === todayStr
                      const isSelected = dStr === date
                      return (
                        <button
                          key={dStr}
                          onClick={() => onDateClick(d)}
                          disabled={isPast}
                          className={`
                            aspect-square rounded-full text-sm font-medium transition-all
                            ${isPast ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-muted cursor-pointer'}
                            ${isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                            ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                          `}
                        >
                          {d.getDate()}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Time slots */}
            {(!hasServices || selectedService) && (
              <section>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Time</p>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : error && !slots.length ? (
                  <div className="text-center py-8 text-muted-foreground">{error}</div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No availability on this date. Try another day.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isSelected = selected?.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          onClick={() => setSelected(slot)}
                          className={`
                            min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-medium
                            transition-all duration-150
                            ${isSelected
                              ? 'bg-primary text-primary-foreground scale-[1.02]'
                              : 'border border-border hover:border-primary bg-card'
                            }
                          `}
                        >
                          {formatTime(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Right: Customer info */}
          <div className="lg:col-span-2">
            <div
              className={`
                sticky top-4 transition-all duration-200 ease-out
                ${selected ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-60'}
              `}
            >
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Your details</p>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                    Your name *
                  </label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                    Email *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-1.5">
                    Phone <span className="text-muted-foreground font-normal">(optional, for SMS)</span>
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 613 555 0123"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>

                {notesExpanded ? (
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium mb-1.5">
                      Notes (optional)
                    </label>
                    <Textarea
                      id="notes"
                      placeholder="Anything you&apos;d like to share..."
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => setNotesExpanded(false)}
                      className="text-xs text-muted-foreground mt-1 hover:underline"
                    >
                      Collapse
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNotesExpanded(true)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Add notes +
                  </button>
                )}

                {selected && (
                  <p className="text-xs text-muted-foreground">
                    {effectiveService?.name} at {formatTime(selected.start)}
                  </p>
                )}

                <Button
                  onClick={handleBooking}
                  disabled={!canSubmit}
                  className="w-full gradient-primary text-white h-12 text-base font-medium"
                >
                  {booking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    `Confirm Booking`
                  )}
                </Button>

                {error && <p className="text-sm text-destructive text-center">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
