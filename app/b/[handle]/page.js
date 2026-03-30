"use client"
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar as CalendarIcon } from 'lucide-react'

function toLocalYmd(d) {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatHandleAsDisplayName(h) {
  if (!h || typeof h !== 'string') return ''
  return h
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

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
  /** From /api/public/services — used to hide call/SMS booking for Starter */
  const [businessPlanTier, setBusinessPlanTier] = useState('starter')
  const [businessMultilingual, setBusinessMultilingual] = useState(false)
  const [publicBookingPhone, setPublicBookingPhone] = useState(null)
  const slotsFetchSeq = useRef(0)
  const bookingFormRef = useRef(null)
  /** Consecutive auto day-advances when initial dates have no slots (max 7). */
  const autoSkipAdvancesDone = useRef(0)

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
        if (!cancelled && res.ok) {
          if (data.businessName?.trim()) {
            setOwnerName(data.businessName.trim())
          }
          if (data.category || data.city) {
            setBusinessMeta({
              category: data.category || '',
              city: data.city || ''
            })
          }
        }
        if (res.ok && data.plan != null) {
          if (!cancelled) setBusinessPlanTier(String(data.plan).toLowerCase())
        }
        if (res.ok && data.multilingual != null) {
          if (!cancelled) setBusinessMultilingual(!!data.multilingual)
        }
        if (res.ok && data.bookingPhone) {
          if (!cancelled) setPublicBookingPhone(data.bookingPhone)
        } else if (!cancelled) {
          setPublicBookingPhone(null)
        }
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
    setDate(toLocalYmd(now))
  }, [])

  useEffect(() => {
    autoSkipAdvancesDone.current = 0
  }, [handle])

  const loadSlots = useCallback(async () => {
    if (!date || !guestTz) return
    const duration = selectedService?.durationMinutes || selectedService?.duration || 30
    if (hasServices && !selectedService) return

    const seq = ++slotsFetchSeq.current
    try {
      setLoading(true)
      setError('')
      setSelected(null)
      const url = `/api/public/availability?handle=${encodeURIComponent(handle)}&date=${date}&tz=${encodeURIComponent(guestTz)}&duration=${duration}`
      let res
      try {
        res = await fetch(url)
      } catch (networkErr) {
        if (seq !== slotsFetchSeq.current) return
        console.error('[booking] Failed to load slots:', networkErr)
        setError('Failed to connect. Please check your internet connection.')
        setSlots([])
        return
      }

      if (!res) {
        if (seq !== slotsFetchSeq.current) return
        setError('Failed to connect. Please check your internet connection.')
        setSlots([])
        return
      }

      let data = {}
      try {
        data = await res.json()
      } catch {
        if (seq !== slotsFetchSeq.current) return
        setError('Unable to read availability response.')
        setSlots([])
        return
      }

      if (!res.ok) {
        if (seq !== slotsFetchSeq.current) return
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
          setError(data.error || data.message || 'Failed to load availability.')
        }
        setSlots([])
        return
      }

      if (seq !== slotsFetchSeq.current) return
      setSlots(Array.isArray(data.slots) ? data.slots : [])
      const display = (data.ownerName || data.businessName || '').trim()
      if (display) {
        setOwnerName(display)
      }

      if (!date && data.slots?.length === 0) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        setDate(toLocalYmd(tomorrow))
      }
    } catch (err) {
      if (seq !== slotsFetchSeq.current) return
      console.error('[booking] Failed to load slots:', err)
      setError('Unable to load available times. Please try again.')
      setSlots([])
    } finally {
      if (seq === slotsFetchSeq.current) {
        setLoading(false)
      }
    }
  }, [handle, date, guestTz, hasServices, selectedService])

  // Fetch slots when date, tz, and service are ready
  useEffect(() => {
    if (date && guestTz && (!hasServices || selectedService)) {
      loadSlots()
    }
  }, [date, guestTz, hasServices, selectedService, loadSlots])

  // If today (local) has no slots, advance day-by-day up to 7 times (e.g. weekend → Monday)
  useEffect(() => {
    if (loading || !date) return
    if (slots.length > 0) {
      autoSkipAdvancesDone.current = 0
      return
    }
    if (autoSkipAdvancesDone.current >= 7) return

    const todayStr = toLocalYmd(new Date())
    if (autoSkipAdvancesDone.current === 0 && date !== todayStr) return

    autoSkipAdvancesDone.current += 1
    const [y, m, d] = date.split('-').map(Number)
    const cur = new Date(y, m - 1, d)
    cur.setDate(cur.getDate() + 1)
    setDate(toLocalYmd(cur))
    setCurrentMonth({ year: cur.getFullYear(), month: cur.getMonth() })
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
    return new Date(isoString).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: guestTz
    })
  }

  const canSubmit =
    hasServices &&
    selectedService &&
    selected &&
    form.name?.trim() &&
    form.email?.trim()?.includes('@') &&
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

  const todayStr = toLocalYmd(new Date())

  const isCalendarAtCurrentMonth = useMemo(() => {
    if (!currentMonth) return true
    const now = new Date()
    return currentMonth.year === now.getFullYear() && currentMonth.month === now.getMonth()
  }, [currentMonth])

  function goPrevMonth() {
    if (!currentMonth) return
    const now = new Date()
    const target = new Date(currentMonth.year, currentMonth.month - 1, 1)
    if (
      target.getFullYear() < now.getFullYear() ||
      (target.getFullYear() === now.getFullYear() && target.getMonth() < now.getMonth())
    ) {
      return
    }
    autoSkipAdvancesDone.current = 0
    setCurrentMonth({ year: target.getFullYear(), month: target.getMonth() })
  }

  function handleSlotSelect(slot) {
    setSelected(slot)
    if (typeof window !== 'undefined' && window.innerWidth < 768 && bookingFormRef.current) {
      setTimeout(() => {
        bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  function goNextMonth() {
    if (!currentMonth) return
    autoSkipAdvancesDone.current = 0
    const d = new Date(currentMonth.year, currentMonth.month + 1, 1)
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() })
  }

  function onDateClick(d) {
    if (!d) return
    autoSkipAdvancesDone.current = 0
    const dStr = toLocalYmd(d)
    if (dStr < todayStr) return
    setDate(dStr)
  }

  // --- Error screen ---
  if (state === 'error') {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Setup Required</h1>
          <p className="text-gray-400">{error}</p>
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
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-white">You&apos;re all set!</h1>
            {selectedService && (
              <p className="text-gray-300 font-medium">
                {selectedService.name} • {selected && formatTime(selected.start)}
              </p>
            )}
            {selected && (
              <p className="text-sm text-gray-400">
                {formatDate(selected.start)}
              </p>
            )}
            {contactDisplay && (
              <p className="text-sm text-gray-400">
                Confirmation sent to {contactDisplay}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {icsDownloadUrl && (
              <Button
                onClick={() => window.open(icsDownloadUrl, '_blank')}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white h-12"
                size="lg"
              >
                <CalendarIcon className="w-5 h-5 mr-2" />
                Add to Calendar
              </Button>
            )}
            <div className="flex flex-col gap-2">
              {rescheduleUrl && (
                <Button
                  type="button"
                  onClick={() => (window.location.href = rescheduleUrl)}
                  variant="outline"
                  className="w-full"
                >
                  Reschedule
                </Button>
              )}
              {cancelUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-red-400/70 hover:text-red-400 text-sm"
                  onClick={() => (window.location.href = cancelUrl)}
                >
                  Cancel booking
                </Button>
              )}
            </div>
            <Button onClick={() => window.location.reload()} variant="ghost" className="w-full">
              Book another time
            </Button>
          </div>
          {bookingResult?.bookingId && (
            <p className="text-xs text-gray-500 text-center">
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
    <main className="min-h-screen bg-gray-950 text-white dark">
      {/* Booking page is intentionally always-dark for brand consistency across all embedded contexts */}
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4 md:px-6">
        <div className="max-w-[900px] mx-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {ownerName?.trim() || formatHandleAsDisplayName(handle)}
            </h1>
            {businessMeta.category ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">
                {businessMeta.category}
              </p>
            ) : null}
          </div>
          {businessMultilingual ? (
            <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-full px-2.5 py-1 self-start">
              <span aria-hidden>🌐</span>
              70+ languages supported
            </span>
          ) : null}
        </div>
      </header>

      <div className="max-w-[900px] mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Services, Calendar, Slots */}
          <div className="lg:col-span-3 space-y-6">
            {!servicesLoading && !hasServices && services.length === 0 && (
              <div className="text-center p-6 bg-yellow-950/40 border border-yellow-700/50 rounded-lg">
                <p className="text-yellow-200 font-medium">
                  This business hasn&apos;t configured their services yet.
                </p>
                <p className="text-yellow-400/90 text-sm mt-1">
                  Please call or text them directly to book an appointment.
                </p>
              </div>
            )}
            {/* Service pills */}
            {hasServices && (
              <section>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Service</p>
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 pb-2" style={{ minWidth: 'min-content' }}>
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
                              whitespace-nowrap flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium
                              transition-all duration-150 cursor-pointer
                              ${isSelected
                                ? 'bg-violet-600 text-white border-2 border-violet-400 scale-105'
                                : 'bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-400'
                              }
                            `}
                          >
                            {svc.name} • {svc.durationMinutes || svc.duration || 30} min
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Calendar */}
            {(!hasServices || selectedService) && (
              <section>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Date</p>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded hover:bg-gray-800 transition-colors text-white"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium">
                      {currentMonth && monthNames[currentMonth.month]} {currentMonth?.year}
                    </span>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded hover:bg-gray-800 transition-colors text-white"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {dayHeaders.map((h) => (
                      <div key={h} className="text-xs text-gray-400 py-1">
                        {h}
                      </div>
                    ))}
                    {calendarDays.map((d, i) => {
                      if (!d) return <div key={`pad-${i}`} className="aspect-square" />
                      const dStr = toLocalYmd(d)
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
                            ${isPast ? 'text-gray-600 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer'}
                            ${isToday ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-gray-950' : ''}
                            ${isSelected ? 'bg-violet-600 text-white' : ''}
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
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Time</p>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  </div>
                ) : error && !slots.length ? (
                  <div className="text-center py-8 text-gray-400">{error}</div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No availability on this date. Try another day.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isSelected = selected?.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => handleSlotSelect(slot)}
                          className={`
                            min-h-[44px] px-3 py-2.5 rounded-lg text-sm font-medium
                            transition-all duration-150
                            ${isSelected
                              ? 'bg-violet-600 text-white scale-[1.02]'
                              : 'border border-gray-700 hover:border-violet-500 bg-gray-900'
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

          {/* Right: Customer info - ONLY show when slot selected */}
          <div className="lg:col-span-2" ref={bookingFormRef}>
            {selected ? (
            <div className="sticky top-4 animate-in slide-in-from-bottom-4 duration-200">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Your details</p>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5 text-gray-300">
                    Your name *
                  </label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-gray-300">
                    Email *
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-1.5 text-gray-300">
                    Phone{' '}
                    <span className="text-gray-500 font-normal">
                      {businessPlanTier === 'starter' ? '(optional)' : '(optional, for SMS)'}
                    </span>
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Phone number"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                {notesExpanded ? (
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium mb-1.5 text-gray-300">
                      Notes (optional)
                    </label>
                    <Textarea
                      id="notes"
                      placeholder="Anything you'd like to share..."
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="resize-none bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNotesExpanded(false)}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors mt-1"
                    >
                      Collapse
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNotesExpanded(true)}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Add notes +
                  </button>
                )}

                {selected && (
                  <p className="text-xs text-gray-400">
                    {effectiveService?.name} at {formatTime(selected.start)}
                  </p>
                )}

                <Button
                  onClick={handleBooking}
                  disabled={!canSubmit}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white h-12 text-base font-medium"
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

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              </div>
            </div>
            ) : (
              <div className="sticky top-4 flex items-center justify-center min-h-[200px] text-gray-500 text-sm border border-dashed border-gray-700 rounded-xl">
                Select a time to continue
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="max-w-[900px] mx-auto px-4 md:px-6 pb-10 pt-2 text-center text-xs text-gray-500">
        {publicBookingPhone ? (
          <p>
            {businessMultilingual ? (
              <>
                Our AI receptionist speaks 70+ languages.{' '}
                <span className="text-gray-400">
                  Or call or text to book: <span className="text-gray-300 font-medium">{publicBookingPhone}</span>
                </span>
              </>
            ) : (
              <span className="text-gray-400">
                Or call or text to book: <span className="text-gray-300 font-medium">{publicBookingPhone}</span>
              </span>
            )}
          </p>
        ) : (
          <p>
            {businessMultilingual
              ? 'Our AI receptionist speaks 70+ languages on eligible plans.'
              : 'Book online — fast and simple.'}
          </p>
        )}
      </footer>
    </main>
  )
}
