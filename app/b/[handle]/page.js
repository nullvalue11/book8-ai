"use client"
import React, { useEffect, useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import { formatPublicServicePriceDisplay } from '@/lib/currency'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, Calendar as CalendarIcon, Phone } from 'lucide-react'
import PublicBusinessInfoPanel from '@/components/public/PublicBusinessInfoPanel'
import LanguageSelector from '@/components/LanguageSelector'
import { useBookingLanguage } from '@/hooks/useBookingLanguage'
import { bookingLocaleBcp47, trFormat } from '@/lib/translations'
import { businessProfileHasPublicDisplay } from '@/lib/businessProfile'
import StripeCardStep from '@/components/StripeCardStep'
import { Switch } from '@/components/ui/switch'

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

function sanitizePhoneHref(phone) {
  if (!phone) return ''
  return String(phone).replace(/[^\d+]/g, '')
}

export default function PublicBookingPage({ params }) {
  const handle = params.handle
  const { language, setLanguage, t } = useBookingLanguage()

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
  const [businessProfile, setBusinessProfile] = useState(null)
  const [businessTimezoneForProfile, setBusinessTimezoneForProfile] = useState(null)
  const [providers, setProviders] = useState([])
  /** null = any team member */
  const [selectedProviderId, setSelectedProviderId] = useState(null)
  const [noShowProtection, setNoShowProtection] = useState(null)
  /** Sanitized subset from /api/public/services */
  const [googlePlaces, setGooglePlaces] = useState(null)
  /** BOO-57B: owner-uploaded portfolio photos */
  const [portfolio, setPortfolio] = useState([])
  const [portfolioFilter, setPortfolioFilter] = useState('all')
  /** BOO-58B: published client reviews */
  const [reviewsData, setReviewsData] = useState(null)
  const [showAllReviews, setShowAllReviews] = useState(false)
  /** BOO-59B */
  const [publicBusinessId, setPublicBusinessId] = useState('')
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [waitlistPreferDates, setWaitlistPreferDates] = useState([])
  const [waitlistTimeRange, setWaitlistTimeRange] = useState('any')
  const [waitlistForm, setWaitlistForm] = useState({ name: '', email: '', phone: '' })
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)
  const [waitlistSubmitError, setWaitlistSubmitError] = useState('')
  /** BOO-60B */
  const [recurringEnabled, setRecurringEnabled] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState('weekly')
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(7)
  const [recurringTotalOccurrences, setRecurringTotalOccurrences] = useState(6)
  const [stripePublishableKey, setStripePublishableKey] = useState(null)
  const [bookingSubStep, setBookingSubStep] = useState('details')
  const slotsFetchSeq = useRef(0)
  const bookingFormRef = useRef(null)
  /** Consecutive auto day-advances when initial dates have no slots (max 7). */
  const autoSkipAdvancesDone = useRef(0)
  const servicesScrollRef = useRef(null)
  const pillRailPointerRef = useRef(null)
  const pillClickSuppressedRef = useRef(false)
  const [servicePillScroll, setServicePillScroll] = useState({ moreLeft: false, moreRight: false })

  const hasGooglePlacesDisplay = useMemo(() => {
    const g = googlePlaces
    if (!g || typeof g !== 'object') return false
    return !!(
      g.rating ||
      g.location ||
      g.googleMapsUrl ||
      g.formattedAddress ||
      (Array.isArray(g.photos) && g.photos.length > 0)
    )
  }, [googlePlaces])

  const portfolioCategories = useMemo(() => {
    const s = new Set()
    for (const ph of portfolio) {
      if (ph && typeof ph.category === 'string' && ph.category.trim()) s.add(ph.category.trim())
    }
    return Array.from(s).sort()
  }, [portfolio])

  const filteredPortfolio = useMemo(() => {
    if (!Array.isArray(portfolio) || portfolio.length === 0) return []
    if (portfolioFilter === 'all') return portfolio
    return portfolio.filter((p) => (p.category || '').trim() === portfolioFilter)
  }, [portfolio, portfolioFilter])

  const hasProfileDisplay = useMemo(
    () =>
      (businessProfile != null && businessProfileHasPublicDisplay(businessProfile)) ||
      hasGooglePlacesDisplay,
    [businessProfile, hasGooglePlacesDisplay]
  )

  const baseFlowStep = useMemo(() => {
    if (selected) return 4
    if (date) return 3
    if (!hasServices || selectedService) return 2
    return 1
  }, [selected, date, hasServices, selectedService])

  const bookingFlowStep = useMemo(() => {
    if (providers.length === 0) return baseFlowStep
    return baseFlowStep === 1 ? 1 : baseFlowStep + 1
  }, [providers.length, baseFlowStep])

  const flowSteps = useMemo(() => {
    if (providers.length > 0) {
      return [
        { n: 1, label: t.service },
        { n: 2, label: t.bookingFlowStaff },
        { n: 3, label: t.date },
        { n: 4, label: t.time },
        { n: 5, label: t.yourDetails }
      ]
    }
    return [
      { n: 1, label: t.service },
      { n: 2, label: t.date },
      { n: 3, label: t.time },
      { n: 4, label: t.yourDetails }
    ]
  }, [providers.length, t])

  const visibleServices = useMemo(() => {
    if (!hasServices || services.length === 0) return services
    if (selectedProviderId == null) return services
    const p = providers.find((pr) => pr.id === selectedProviderId)
    if (!p) return services
    const ids = p.serviceIds || []
    if (!ids.length) return services
    return services.filter((s) => ids.includes(String(s.serviceId || s.id || '')))
  }, [hasServices, services, providers, selectedProviderId])

  const updateServicePillScroll = useCallback(() => {
    const el = servicesScrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const eps = 4
    if (maxScroll <= eps) {
      setServicePillScroll({ moreLeft: false, moreRight: false })
      return
    }
    setServicePillScroll({
      moreLeft: el.scrollLeft > eps,
      moreRight: el.scrollLeft < maxScroll - eps
    })
  }, [])

  const scrollServicePills = useCallback((direction) => {
    const el = servicesScrollRef.current
    if (!el) return
    const delta = Math.max(120, Math.floor(el.clientWidth * 0.65)) * direction
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  const onPillRailPointerDownCapture = useCallback((e) => {
    if (e.pointerType === 'touch') return
    if (e.button !== 0) return
    pillClickSuppressedRef.current = false
    const el = servicesScrollRef.current
    if (!el || el.scrollWidth <= el.clientWidth + 4) return
    pillRailPointerRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      dragging: false
    }
  }, [])

  const onPillRailPointerMove = useCallback((e) => {
    const st = pillRailPointerRef.current
    const el = servicesScrollRef.current
    if (!st || e.pointerId !== st.pointerId || !el) return
    const dx = e.clientX - st.startX
    if (!st.dragging && Math.abs(dx) < 8) return
    if (!st.dragging) {
      st.dragging = true
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    el.scrollLeft = st.startScroll - dx
    e.preventDefault()
  }, [])

  const onPillRailPointerUpOrCancel = useCallback((e) => {
    const st = pillRailPointerRef.current
    const el = servicesScrollRef.current
    if (!st || e.pointerId !== st.pointerId) return
    if (st.dragging) {
      pillClickSuppressedRef.current = true
      try {
        el?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      updateServicePillScroll()
    }
    pillRailPointerRef.current = null
  }, [updateServicePillScroll])

  useLayoutEffect(() => {
    if (!hasServices || servicesLoading) return
    updateServicePillScroll()
  }, [hasServices, servicesLoading, services, visibleServices, selectedService, updateServicePillScroll])

  useEffect(() => {
    const el = servicesScrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      updateServicePillScroll()
    })
    ro.observe(el)
    window.addEventListener('resize', updateServicePillScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateServicePillScroll)
    }
  }, [hasServices, servicesLoading, updateServicePillScroll])

  // Detect timezone
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    setGuestTz(detected)
  }, [])

  useEffect(() => {
    setPortfolioFilter('all')
    setShowAllReviews(false)
    setWaitlistSuccess(false)
    setWaitlistSubmitError('')
    setWaitlistForm({ name: '', email: '', phone: '' })
    setRecurringEnabled(false)
    setRecurringFrequency('weekly')
    setRecurringIntervalDays(7)
    setRecurringTotalOccurrences(6)
  }, [handle])

  useEffect(() => {
    setWaitlistSuccess(false)
    setWaitlistSubmitError('')
    if (date) setWaitlistPreferDates([date])
  }, [date])

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
        if (!cancelled && res.ok && data.businessId) {
          setPublicBusinessId(String(data.businessId))
        }
        if (!cancelled && res.ok) {
          setWaitlistEnabled(data.waitlistEnabled !== false)
        }
        if (!cancelled && res.ok) {
          setBusinessProfile(data.businessProfile && typeof data.businessProfile === 'object' ? data.businessProfile : null)
          setBusinessTimezoneForProfile(data.businessTimezone || null)
          setGooglePlaces(
            data.googlePlaces && typeof data.googlePlaces === 'object' ? data.googlePlaces : null
          )
          setPortfolio(Array.isArray(data.portfolio) ? data.portfolio : [])
          const rev = data.reviews
          if (
            rev &&
            typeof rev === 'object' &&
            typeof rev.totalReviews === 'number' &&
            rev.totalReviews > 0
          ) {
            setReviewsData(rev)
          } else {
            setReviewsData(null)
          }
        } else if (!cancelled && !res.ok) {
          setGooglePlaces(null)
          setPortfolio([])
          setReviewsData(null)
        }
        if (!cancelled && res.ok) {
          setProviders(Array.isArray(data.providers) ? data.providers : [])
          setNoShowProtection(
            data.noShowProtection && typeof data.noShowProtection === 'object'
              ? data.noShowProtection
              : null
          )
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

  useEffect(() => {
    if (!noShowProtection?.enabled) {
      setStripePublishableKey(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/public/stripe-key')
        const d = await r.json()
        if (!cancelled && d.publishableKey) setStripePublishableKey(d.publishableKey)
      } catch {
        if (!cancelled) setStripePublishableKey(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [noShowProtection?.enabled])

  useEffect(() => {
    setBookingSubStep('details')
  }, [selected])

  // Auto-select first service when services load
  useEffect(() => {
    if (services.length > 0 && !selectedService) {
      setSelectedService(services[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit selectedService to avoid loop
  }, [services])

  // Keep selected service in sync when provider filter narrows the list
  useEffect(() => {
    if (!hasServices || visibleServices.length === 0) return
    const sid = (s) => String(s?.serviceId || s?.id || '')
    const curId = selectedService ? sid(selectedService) : ''
    const ok =
      curId &&
      visibleServices.some(
        (s) => sid(s) === curId || (selectedService?.name && s.name === selectedService.name)
      )
    if (!ok) setSelectedService(visibleServices[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional when filter list changes
  }, [hasServices, visibleServices, providers, selectedProviderId])

  // Initialize date to today
  useEffect(() => {
    const now = new Date()
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() })
    setDate(toLocalYmd(now))
  }, [])

  useEffect(() => {
    autoSkipAdvancesDone.current = 0
  }, [handle])

  useEffect(() => {
    setError('')
  }, [language])

  const loadSlots = useCallback(async () => {
    if (!date || !guestTz) return
    const duration = selectedService?.durationMinutes || selectedService?.duration || 30
    if (hasServices && !selectedService) return

    const seq = ++slotsFetchSeq.current
    try {
      setLoading(true)
      setError('')
      setSelected(null)
      let url = `/api/public/availability?handle=${encodeURIComponent(handle)}&date=${date}&tz=${encodeURIComponent(guestTz)}&duration=${duration}`
      if (selectedProviderId) {
        url += `&providerId=${encodeURIComponent(selectedProviderId)}`
      }
      let res
      try {
        res = await fetch(url)
      } catch (networkErr) {
        if (seq !== slotsFetchSeq.current) return
        console.error('[booking] Failed to load slots:', networkErr)
        setError(t.errFailedConnect)
        setSlots([])
        return
      }

      if (!res) {
        if (seq !== slotsFetchSeq.current) return
        setError(t.errFailedConnect)
        setSlots([])
        return
      }

      let data = {}
      try {
        data = await res.json()
      } catch {
        if (seq !== slotsFetchSeq.current) return
        setError(t.errReadAvailability)
        setSlots([])
        return
      }

      if (!res.ok) {
        if (seq !== slotsFetchSeq.current) return
        if (data.code === 'GOOGLE_INVALID_GRANT') {
          setError(data.hint || t.errCalendarReconnect)
          setState('error')
        } else if (res.status === 404) {
          if (data.error?.includes('not configured')) {
            setError(t.errBeingSetup)
            setState('error')
          } else {
            setError(t.errPageNotFound)
            setState('error')
          }
        } else if (res.status === 429) {
          setError(t.errTooManyRequests)
        } else {
          setError(data.error || data.message || t.errLoadAvailability)
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
      setError(t.errUnableLoadTimes)
      setSlots([])
    } finally {
      if (seq === slotsFetchSeq.current) {
        setLoading(false)
      }
    }
  }, [handle, date, guestTz, hasServices, selectedService, selectedProviderId, t])

  const resetBookingFlow = useCallback(() => {
    setState('form')
    setBookingResult(null)
    setSelected(null)
    setForm({ name: '', email: '', phone: '', notes: '' })
    setNotesExpanded(false)
    setError('')
    setBooking(false)
    const now = new Date()
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() })
    setDate(toLocalYmd(now))
    setSlots([])
    if (services.length > 0) setSelectedService(services[0])
    setSelectedProviderId(null)
    setBookingSubStep('details')
    setRecurringEnabled(false)
    setRecurringFrequency('weekly')
    setRecurringIntervalDays(7)
    setRecurringTotalOccurrences(6)
  }, [services])

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

  const needsCardStep = !!(noShowProtection?.enabled && stripePublishableKey)
  const noShowConfigButNoStripe = !!(noShowProtection?.enabled && !stripePublishableKey)

  const bookingLocale = bookingLocaleBcp47(language)
  const wl = t.waitlist || {}
  const rc = t.recurring || {}
  const showRecurringOption = businessPlanTier !== 'starter'

  const waitlistDateOptions = useMemo(() => {
    if (!date) return []
    const d = new Date(`${date}T12:00:00`)
    if (Number.isNaN(d.getTime())) return []
    const out = []
    for (let i = 0; i < 14; i++) {
      const x = new Date(d)
      x.setDate(x.getDate() + i)
      out.push(toLocalYmd(x))
    }
    return out
  }, [date])

  const toggleWaitlistDate = useCallback((ymd) => {
    setWaitlistPreferDates((prev) => {
      if (prev.includes(ymd)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== ymd)
      }
      if (prev.length >= 8) return prev
      return [...prev, ymd]
    })
  }, [])

  const noShowFeeDisplay = useMemo(() => {
    if (!noShowProtection?.enabled) return ''
    if (noShowProtection.feeType === 'percentage') {
      return `${noShowProtection.feeAmount}%`
    }
    const cur = String(noShowProtection.currency || 'cad').toUpperCase()
    try {
      return new Intl.NumberFormat(bookingLocale, {
        style: 'currency',
        currency: cur.length === 3 ? cur : 'CAD'
      }).format(Number(noShowProtection.feeAmount) || 0)
    } catch {
      return `$${noShowProtection.feeAmount ?? 0}`
    }
  }, [noShowProtection, bookingLocale])

  function servicePriceCentsFromSelected() {
    const s = selectedService
    if (!s) return undefined
    if (typeof s.priceCents === 'number' && !Number.isNaN(s.priceCents)) return s.priceCents
    if (typeof s.priceAmount === 'number' && !Number.isNaN(s.priceAmount)) {
      return Math.round(s.priceAmount * 100)
    }
    if (s.price != null && s.price !== '') {
      const n =
        typeof s.price === 'number'
          ? s.price
          : parseFloat(String(s.price).replace(/^\$/, '').trim())
      if (Number.isFinite(n)) return Math.round(n * 100)
    }
    return undefined
  }

  async function submitWaitlist(e) {
    e?.preventDefault?.()
    if (!publicBusinessId || !handle) return
    const name = waitlistForm.name.trim()
    const email = waitlistForm.email.trim()
    if (name.length < 2) {
      setWaitlistSubmitError(t.required)
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistSubmitError(t.invalidEmail)
      return
    }
    if (waitlistPreferDates.length === 0) {
      setWaitlistSubmitError(wl.pickDateHint || t.required)
      return
    }
    setWaitlistSubmitting(true)
    setWaitlistSubmitError('')
    try {
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle,
          name,
          email,
          phone: waitlistForm.phone.trim() || undefined,
          preferredDates: waitlistPreferDates,
          preferredTimeRange: waitlistTimeRange,
          serviceId: selectedService?.serviceId || selectedService?.id || '',
          serviceName: selectedService?.name || ''
        })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setWaitlistSubmitError(typeof data.error === 'string' ? data.error : (wl.submitError || ''))
        return
      }
      setWaitlistSuccess(true)
      setWaitlistForm({ name: '', email: '', phone: '' })
    } catch {
      setWaitlistSubmitError(wl.submitError || t.required)
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  async function handleBooking(setupIntentIdParam) {
    if (!selected) {
      setError(t.errSelectSlot)
      return
    }
    if (!form.name?.trim()) {
      setError(t.errEnterName)
      return
    }
    if (!form.email?.trim()?.includes('@')) {
      setError(t.errEnterEmail)
      return
    }
    if (needsCardStep && !setupIntentIdParam) {
      setError(t.noShow.cardError)
      return
    }
    if (noShowConfigButNoStripe) {
      setError(t.noShow.cardError)
      return
    }

    try {
      setBooking(true)
      setError('')

      const e = (form.email || '').trim()
      const p = (form.phone || '').trim()
      if (!e || !e.includes('@')) {
        setError(t.errEmailRequiredConfirm)
        setBooking(false)
        return
      }

      const provName =
        selectedProviderId && providers.length
          ? providers.find((x) => x.id === selectedProviderId)?.name?.trim() || ''
          : ''
      const svcCents = servicePriceCentsFromSelected()
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
          serviceId: selectedService?.serviceId || selectedService?.id,
          language,
          ...(selectedProviderId
            ? { providerId: selectedProviderId, providerName: provName || 'Provider' }
            : {}),
          ...(needsCardStep && setupIntentIdParam
            ? { setupIntentId: String(setupIntentIdParam) }
            : {}),
          ...(svcCents != null ? { servicePriceCents: svcCents } : {}),
          ...(selectedService?.name
            ? { serviceName: selectedService.name }
            : !hasServices
              ? { serviceName: t.defaultAppointment }
              : {}),
          ...(recurringEnabled && showRecurringOption
            ? {
                recurring: {
                  enabled: true,
                  frequency: recurringFrequency,
                  intervalDays: recurringFrequency === 'custom' ? recurringIntervalDays : null,
                  totalOccurrences: recurringTotalOccurrences
                }
              }
            : {})
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setError(t.errSlotTaken)
          loadSlots()
        } else if (res.status === 429) {
          setError(t.errTooManyAttempts)
        } else {
          setError(data.error || t.errBookingFailed)
        }
        return
      }

      setBookingResult(data)
      setState('success')
    } catch (err) {
      console.error('Booking error:', err)
      setError(t.errCompleteBooking)
    } finally {
      setBooking(false)
    }
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString(bookingLocale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: guestTz
    })
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString(bookingLocale, {
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
    !booking &&
    !noShowConfigButNoStripe

  // --- Calendar helpers ---
  const dayHeaders = [t.daySun, t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat]
  const monthYearLabel =
    currentMonth != null
      ? new Date(currentMonth.year, currentMonth.month, 15).toLocaleDateString(bookingLocale, {
          month: 'long',
          year: 'numeric'
        })
      : ''

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
      <main
        lang={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gray-950 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t.setupRequired}</h1>
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            {t.refreshPage}
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
      <main
        lang={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gray-950 flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-white">
              {bookingResult?.recurring ? rc.recurringConfirmed : t.allSet}
            </h1>
            {bookingResult?.recurring && selected ? (
              <>
                <p className="text-gray-300 text-sm">
                  {trFormat(rc.firstAppointment, { date: formatDate(selected.start) })}
                </p>
                <p className="text-sm text-gray-400">{rc.futureConfirmations}</p>
              </>
            ) : (
              <>
                {selectedService && (
                  <p className="text-gray-300 font-medium">
                    {selectedService.name} • {selected && formatTime(selected.start)}
                  </p>
                )}
                {selectedProviderId &&
                providers.find((x) => x.id === selectedProviderId)?.name?.trim() ? (
                  <p className="text-sm text-violet-200/90">
                    {trFormat(t.upcomingBookingWithProvider, {
                      name: providers.find((x) => x.id === selectedProviderId).name.trim()
                    })}
                  </p>
                ) : null}
                {selected && (
                  <p className="text-sm text-gray-400">
                    {formatDate(selected.start)}
                  </p>
                )}
                {contactDisplay && (
                  <p className="text-sm text-gray-400">
                    {t.confirmationSentTo} {contactDisplay}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-3">
            {icsDownloadUrl && (
              <Button
                type="button"
                onClick={() => window.open(icsDownloadUrl, '_blank')}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white h-12"
                size="lg"
              >
                <CalendarIcon className="w-5 h-5 me-2 rtl:-scale-x-100" />
                {t.addToCalendar}
              </Button>
            )}
            {rescheduleUrl && (
              <Button
                type="button"
                onClick={() => { window.location.href = rescheduleUrl }}
                variant="outline"
                className="w-full"
              >
                {t.reschedule}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full text-violet-400 border-violet-400/40 hover:bg-violet-400/10"
              onClick={resetBookingFlow}
            >
              {t.bookAnotherTime}
            </Button>
            {cancelUrl && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-red-400/70 hover:text-red-400 text-sm"
                onClick={() => { window.location.href = cancelUrl }}
              >
                {t.cancelBooking}
              </Button>
            )}
          </div>
          {bookingResult?.bookingId && (
            <p className="text-xs text-gray-500 text-center">
              {t.bookingId} <span className="font-mono">{bookingResult.bookingId}</span>
            </p>
          )}
        </div>
      </main>
    )
  }

  // --- Main booking flow ---
  const effectiveService = hasServices
    ? selectedService
    : { name: t.defaultAppointment, durationMinutes: 30, duration: 30 }

  return (
    <main
      id="main-content"
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gray-950 text-white dark"
    >
      {/* Booking page is intentionally always-dark for brand consistency across all embedded contexts */}
      {/* BOO-57B: business portfolio first, then Google photos */}
      {filteredPortfolio.length > 0 ? (
        <div
          className="w-full px-4 md:px-6 pt-4 pb-2"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <h2 className="text-lg font-semibold text-white mb-3">
            {t.portfolio?.title || 'Our Work'}
          </h2>
          {portfolioCategories.length > 1 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPortfolioFilter('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  portfolioFilter === 'all'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {t.portfolio?.allCategories || 'All'}
              </button>
              {portfolioCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPortfolioFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    portfolioFilter === cat
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filteredPortfolio.map((photo) => (
              <div
                key={photo.id}
                className="relative group rounded-lg overflow-hidden border border-gray-800 bg-gray-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={
                    photo.caption ||
                    (ownerName?.trim() || formatHandleAsDisplayName(handle)
                      ? `${ownerName?.trim() || formatHandleAsDisplayName(handle)}`
                      : 'Business photo')
                  }
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                {photo.caption ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 p-2">
                    <p className="text-white text-sm line-clamp-2">{photo.caption}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {googlePlaces?.photos?.length > 0 ? (
        <div className="w-full px-4 md:px-6 pt-2 pb-2">
          <p className="text-xs text-gray-400 mb-2">
            {t.portfolio?.googlePhotos || t.googlePlaces?.photosFromGoogle || 'Photos'}
          </p>
          <div
            className="w-full overflow-x-auto flex gap-2 pb-2 snap-x snap-mandatory scroll-smooth"
            dir="ltr"
          >
            {googlePlaces.photos.slice(0, 5).map((photo, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/api/places/photo?reference=${encodeURIComponent(photo.reference)}&maxwidth=600`}
                alt={
                  ownerName?.trim() || formatHandleAsDisplayName(handle)
                    ? `${ownerName?.trim() || formatHandleAsDisplayName(handle)} photo ${i + 1}`
                    : `Business photo ${i + 1}`
                }
                className="h-48 w-72 max-h-[12rem] object-cover rounded-lg flex-shrink-0 snap-start"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : null}
      {reviewsData && reviewsData.totalReviews > 0 && Array.isArray(reviewsData.reviews) ? (
        <div
          className="w-full px-4 md:px-6 pt-4 pb-2"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-white">{t.reviews?.title || 'Reviews'}</h2>
            <span className="text-yellow-400 font-medium">
              ★ {reviewsData.averageRating.toFixed(1)}
            </span>
            <span className="text-gray-400 text-sm">
              ({reviewsData.totalReviews}{' '}
              {t.reviews?.reviewsOnBook8 || 'reviews on Book8'})
            </span>
          </div>
          {googlePlaces?.rating != null && reviewsData.totalReviews > 0 ? (
            <p className="text-xs text-gray-500 mb-3">
              ★ {googlePlaces.rating}
              {googlePlaces.reviewCount != null ? ` (${googlePlaces.reviewCount} ${t.reviews?.onGoogle || 'on Google'})` : ''}
              {' · '}
              ★ {reviewsData.averageRating.toFixed(1)} ({reviewsData.totalReviews}{' '}
              {t.reviews?.reviewsOnBook8 || 'Book8'})
            </p>
          ) : null}
          <div className="space-y-4">
            {(showAllReviews ? reviewsData.reviews : reviewsData.reviews.slice(0, 5)).map(
              (review) => (
                <div
                  key={review.id}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-900/50"
                  dir="auto"
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="flex text-yellow-400 text-lg" aria-hidden>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>{star <= review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <span className="text-gray-400 text-sm">{review.customerName}</span>
                  </div>
                  {review.comment ? (
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{review.comment}</p>
                  ) : null}
                  <p className="text-gray-500 text-xs mt-2">
                    {review.serviceName}
                    {review.serviceName ? ' · ' : ''}
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              )
            )}
          </div>
          {reviewsData.totalReviews > 5 ? (
            <button
              type="button"
              className="text-violet-400 hover:text-violet-300 text-sm font-medium mt-4"
              onClick={() => setShowAllReviews((v) => !v)}
            >
              {showAllReviews
                ? t.collapse || 'Show less'
                : t.reviews?.seeAllReviews || 'See all reviews'}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-4 md:px-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            {businessProfile?.logo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={businessProfile.logo.url}
                alt={`${ownerName?.trim() || formatHandleAsDisplayName(handle)} logo`}
                className="w-12 h-12 md:w-16 md:h-16 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">
              {ownerName?.trim() || formatHandleAsDisplayName(handle)}
            </h1>
            {googlePlaces?.rating ? (
              <div className="flex items-center gap-1.5 text-sm mt-1">
                <span className="text-yellow-400" aria-hidden>
                  ★
                </span>
                <span className="font-medium text-white">{googlePlaces.rating}</span>
                {googlePlaces.reviewCount != null && t.googlePlaces ? (
                  <span className="text-gray-400">
                    ({googlePlaces.reviewCount} {t.googlePlaces.reviewsOnGoogle})
                  </span>
                ) : null}
              </div>
            ) : null}
            {businessMeta.category ? (
              <p className="text-xs uppercase tracking-wide text-muted-foreground mt-0.5">
                {businessMeta.category}
              </p>
            ) : null}
            {publicBookingPhone ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-400 text-sm mt-2">
                <Phone className="w-4 h-4 shrink-0" aria-hidden />
                <a
                  href={`tel:${sanitizePhoneHref(publicBookingPhone)}`}
                  className="hover:text-white transition-colors"
                >
                  {publicBookingPhone}
                </a>
                <span className="text-gray-600" aria-hidden>
                  ·
                </span>
                <a
                  href={`sms:${sanitizePhoneHref(publicBookingPhone)}`}
                  className="hover:text-white transition-colors"
                >
                  {t.textUs}
                </a>
              </div>
            ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end self-start">
            {businessMultilingual ? (
              <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-full px-2.5 py-1">
                <span aria-hidden>🌐</span>
                {t.languages}
              </span>
            ) : null}
            <LanguageSelector value={language} onChange={setLanguage} t={t} className="shrink-0" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4">
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-5 text-xs text-gray-500" aria-label={t.bookingFlowAria}>
          {flowSteps.map(({ n, label }, idx) => (
            <React.Fragment key={n}>
              {idx > 0 ? (
                <span className="hidden sm:inline text-gray-600" aria-hidden>
                  →
                </span>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold shrink-0 ${
                    bookingFlowStep === n
                      ? 'bg-violet-600 text-white'
                      : bookingFlowStep > n
                        ? 'bg-gray-700 text-gray-300'
                        : 'bg-gray-800 text-gray-500'
                  }`}
                  aria-current={bookingFlowStep === n ? 'step' : undefined}
                >
                  {n}
                </span>
                <span className={bookingFlowStep === n ? 'text-white font-medium' : ''}>{label}</span>
              </span>
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
          {hasProfileDisplay ? (
            <div className="lg:col-span-3">
              <PublicBusinessInfoPanel
                businessProfile={businessProfile}
                businessDisplayName={ownerName?.trim() || formatHandleAsDisplayName(handle)}
                businessTimeZone={businessTimezoneForProfile || guestTz}
                googlePlaces={googlePlaces}
                t={t}
              />
            </div>
          ) : null}
          {/* Services, Calendar, Slots */}
          <div className={`space-y-6 order-2 ${hasProfileDisplay ? 'lg:col-span-5' : 'lg:col-span-8'}`}>
            {!servicesLoading && !hasServices && services.length === 0 && (
              <div className="text-center p-6 bg-yellow-950/40 border border-yellow-700/50 rounded-lg">
                <p className="text-yellow-200 font-medium">
                  {t.noServicesTitle}
                </p>
                <p className="text-yellow-400/90 text-sm mt-1">
                  {t.noServicesHint}
                </p>
              </div>
            )}
            {/* Service pills */}
            {hasServices && (
              <section>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{t.service}</p>
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  </div>
                ) : (
                  <div className="relative -mx-1" dir="ltr">
                    <div
                      className={[
                        'pointer-events-none absolute inset-y-0 left-0 z-10 w-10 sm:w-12',
                        'bg-gradient-to-r from-gray-950 from-25% to-transparent',
                        'transition-opacity duration-200',
                        servicePillScroll.moreLeft ? 'opacity-100' : 'opacity-0'
                      ].join(' ')}
                      aria-hidden
                    />
                    <div
                      className={[
                        'pointer-events-none absolute inset-y-0 right-0 z-10 w-10 sm:w-12',
                        'bg-gradient-to-l from-gray-950 from-25% to-transparent',
                        'transition-opacity duration-200',
                        servicePillScroll.moreRight ? 'opacity-100' : 'opacity-0'
                      ].join(' ')}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className={[
                        'absolute left-0 top-0 bottom-0 z-20 flex w-10 sm:w-11 items-center justify-center rounded-md',
                        'text-white/90 hover:text-white hover:bg-white/5 active:bg-white/10',
                        'transition-opacity duration-200 min-h-[44px]',
                        servicePillScroll.moreLeft ? 'opacity-100' : 'pointer-events-none opacity-0'
                      ].join(' ')}
                      onClick={() => scrollServicePills(-1)}
                      aria-label={t.scrollServicesPrev}
                    >
                      <ChevronLeft className="h-6 w-6 drop-shadow" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={[
                        'absolute right-0 top-0 bottom-0 z-20 flex w-10 sm:w-11 items-center justify-center rounded-md',
                        'text-white/90 hover:text-white hover:bg-white/5 active:bg-white/10',
                        'transition-opacity duration-200 min-h-[44px]',
                        servicePillScroll.moreRight ? 'opacity-100' : 'pointer-events-none opacity-0'
                      ].join(' ')}
                      onClick={() => scrollServicePills(1)}
                      aria-label={t.scrollServicesNext}
                    >
                      <ChevronRight className="h-6 w-6 drop-shadow" aria-hidden />
                    </button>
                    <div
                      ref={servicesScrollRef}
                      onScroll={updateServicePillScroll}
                      onPointerDownCapture={onPillRailPointerDownCapture}
                      onPointerMove={onPillRailPointerMove}
                      onPointerUp={onPillRailPointerUpOrCancel}
                      onPointerCancel={onPillRailPointerUpOrCancel}
                      className={[
                        'w-full overflow-x-auto scrollbar-hide scroll-smooth touch-pan-x',
                        'snap-x snap-mandatory cursor-grab active:cursor-grabbing',
                        'ps-1 pe-1 sm:ps-2 sm:pe-2',
                        '[overscroll-behavior-x:contain]'
                      ].join(' ')}
                    >
                      <div className="flex w-max gap-2 pb-2 pt-0.5">
                        {visibleServices.map((svc) => {
                          const isSelected =
                            (selectedService?.serviceId && selectedService.serviceId === svc.serviceId) ||
                            (selectedService?.id && selectedService.id === svc.id) ||
                            selectedService?.name === svc.name
                          const priceLabel = formatPublicServicePriceDisplay(svc)
                          return (
                            <button
                              key={svc.serviceId || svc.id || svc.name}
                              type="button"
                              onClick={(ev) => {
                                if (pillClickSuppressedRef.current) {
                                  ev.preventDefault()
                                  pillClickSuppressedRef.current = false
                                  return
                                }
                                setSelectedService(svc)
                              }}
                              className={[
                                'snap-start whitespace-nowrap shrink-0 px-4 py-2.5 rounded-full text-sm font-medium',
                                'transition-all duration-150 cursor-pointer select-none',
                                isSelected
                                  ? 'bg-violet-600 text-white border-2 border-violet-400 scale-105'
                                  : 'bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-400'
                              ].join(' ')}
                            >
                              {svc.name} • {svc.durationMinutes || svc.duration || 30} {t.minSuffix}
                              {priceLabel != null ? (
                                <span
                                  className={`ms-1 tabular-nums ${isSelected ? 'text-violet-100/85' : 'text-gray-400'}`}
                                >
                                  • {priceLabel}
                                </span>
                              ) : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {providers.length > 0 && !servicesLoading && (
              <section className={language === 'ar' ? 'rtl:text-right' : ''}>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{t.bookingFlowStaff}</p>
                <div
                  className={[
                    'flex gap-2 overflow-x-auto pb-2 -mx-1 px-1',
                    'scrollbar-hide scroll-smooth touch-pan-x [overscroll-behavior-x:contain]'
                  ].join(' ')}
                  dir="ltr"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProviderId(null)
                      setSelected(null)
                    }}
                    className={[
                      'snap-start shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150',
                      selectedProviderId == null
                        ? 'bg-violet-600 text-white border-2 border-violet-400'
                        : 'bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-400'
                    ].join(' ')}
                  >
                    {t.providerAnyAvailable}
                  </button>
                  {providers.map((p) => {
                    const sel = selectedProviderId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProviderId(p.id)
                          setSelected(null)
                        }}
                        className={[
                          'snap-start shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-150',
                          'inline-flex items-center gap-2 max-w-[220px]',
                          sel
                            ? 'bg-violet-600 text-white border-2 border-violet-400'
                            : 'bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-400'
                        ].join(' ')}
                      >
                        {p.avatar?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatar.url}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                            loading="lazy"
                          />
                        ) : null}
                        <span className="truncate">{p.name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Calendar */}
            {(!hasServices || selectedService) && (
              <section>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{t.date}</p>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded hover:bg-gray-800 transition-colors text-white"
                      aria-label={t.ariaPrevMonth}
                    >
                      <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <span className="text-sm font-medium">
                      {monthYearLabel}
                    </span>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded hover:bg-gray-800 transition-colors text-white"
                      aria-label={t.ariaNextMonth}
                    >
                      <ChevronRight className="w-5 h-5 rtl:rotate-180" />
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
                      const ariaDayLabel = d.toLocaleDateString(bookingLocale, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => onDateClick(d)}
                          disabled={isPast}
                          aria-label={ariaDayLabel}
                          aria-pressed={isSelected}
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
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">{t.time}</p>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  </div>
                ) : error && !slots.length ? (
                  <div className="text-center py-8 text-gray-400">{error}</div>
                ) : slots.length === 0 ? (
                  <div className="space-y-4 py-2">
                    <p className="text-center text-gray-400">{t.noAvailabilityTryAnother}</p>
                    {waitlistEnabled &&
                    publicBusinessId &&
                    date &&
                    !error &&
                    (!hasServices || selectedService) ? (
                      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-4 text-left">
                        {waitlistSuccess ? (
                          <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/40 px-3 py-3 text-sm text-emerald-100">
                            <p className="font-medium text-emerald-50">{wl.successTitle}</p>
                            <p className="text-emerald-200/90 mt-1">{wl.successBody}</p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-semibold text-white">{wl.joinTitle}</p>
                              <p className="text-xs text-gray-400 mt-1">{wl.joinSubtitle}</p>
                            </div>
                            <form onSubmit={submitWaitlist} className="space-y-3">
                              <div>
                                <Label className="text-gray-300 text-xs">{wl.preferredDates}</Label>
                                <p className="text-[11px] text-gray-500 mb-2">{wl.maxDatesHint}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {waitlistDateOptions.map((ymd) => {
                                    const on = waitlistPreferDates.includes(ymd)
                                    return (
                                      <button
                                        key={ymd}
                                        type="button"
                                        onClick={() => toggleWaitlistDate(ymd)}
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                          on
                                            ? 'bg-violet-600 text-white'
                                            : 'border border-gray-700 text-gray-300 hover:border-violet-500'
                                        }`}
                                      >
                                        {new Date(`${ymd}T12:00:00`).toLocaleDateString(bookingLocale, {
                                          weekday: 'short',
                                          month: 'short',
                                          day: 'numeric'
                                        })}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                              <div>
                                <Label className="text-gray-300 text-xs">{wl.timePreference}</Label>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {[
                                    { k: 'morning', lab: wl.morning },
                                    { k: 'afternoon', lab: wl.afternoon },
                                    { k: 'evening', lab: wl.evening },
                                    { k: 'any', lab: wl.anyTime }
                                  ].map(({ k, lab }) => (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => setWaitlistTimeRange(k)}
                                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                                        waitlistTimeRange === k
                                          ? 'bg-violet-600 text-white'
                                          : 'border border-gray-700 text-gray-300 hover:border-violet-500'
                                      }`}
                                    >
                                      {lab}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="wl-name" className="text-gray-300">
                                  {t.yourName}
                                </Label>
                                <Input
                                  id="wl-name"
                                  autoComplete="name"
                                  value={waitlistForm.name}
                                  onChange={(e) =>
                                    setWaitlistForm((f) => ({ ...f, name: e.target.value }))
                                  }
                                  className="mt-1 min-h-[44px] bg-gray-800 border-gray-700 text-white"
                                />
                              </div>
                              <div>
                                <Label htmlFor="wl-email" className="text-gray-300">
                                  {t.emailStar}
                                </Label>
                                <Input
                                  id="wl-email"
                                  type="email"
                                  autoComplete="email"
                                  value={waitlistForm.email}
                                  onChange={(e) =>
                                    setWaitlistForm((f) => ({ ...f, email: e.target.value }))
                                  }
                                  className="mt-1 min-h-[44px] bg-gray-800 border-gray-700 text-white"
                                />
                              </div>
                              <div>
                                <Label htmlFor="wl-phone" className="text-gray-300">
                                  {t.phone} <span className="text-gray-500">{t.phoneOptional}</span>
                                </Label>
                                <Input
                                  id="wl-phone"
                                  type="tel"
                                  autoComplete="tel"
                                  value={waitlistForm.phone}
                                  onChange={(e) =>
                                    setWaitlistForm((f) => ({ ...f, phone: e.target.value }))
                                  }
                                  className="mt-1 min-h-[44px] bg-gray-800 border-gray-700 text-white"
                                />
                              </div>
                              {waitlistSubmitError ? (
                                <p className="text-sm text-red-400">{waitlistSubmitError}</p>
                              ) : null}
                              <Button
                                type="submit"
                                disabled={waitlistSubmitting}
                                className="w-full min-h-[44px] bg-violet-600 hover:bg-violet-500"
                              >
                                {waitlistSubmitting ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {wl.submitting}
                                  </span>
                                ) : (
                                  wl.submit
                                )}
                              </Button>
                            </form>
                          </>
                        )}
                      </div>
                    ) : null}
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
                          aria-pressed={isSelected}
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
          <div className="lg:col-span-4 order-3" ref={bookingFormRef}>
            {selected ? (
            <div className="sticky top-4 animate-in slide-in-from-bottom-4 duration-200">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
                {noShowConfigButNoStripe ? (
                  <p className="text-sm text-amber-400">
                    {t.noShow.cardError}
                  </p>
                ) : null}

                {bookingSubStep === 'details' ? (
                  <>
                <p className="text-xs uppercase tracking-wide text-gray-400">{t.yourDetails}</p>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1.5 text-gray-300">
                    {t.yourName}
                  </label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder={t.placeholderName}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-gray-300">
                    {t.emailStar}
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t.placeholderEmail}
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-1.5 text-gray-300">
                    {t.phone}{' '}
                    <span className="text-gray-500 font-normal">
                      {businessPlanTier === 'starter' ? t.phoneOptional : t.phoneOptionalSms}
                    </span>
                  </label>
                  <Input
                    id="phone"
                    name="tel"
                    type="tel"
                    autoComplete="tel"
                    placeholder={t.placeholderPhone}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="min-h-[44px] bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                {notesExpanded ? (
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium mb-1.5 text-gray-300">
                      {t.notesOptional}
                    </label>
                    <Textarea
                      id="notes"
                      placeholder={t.notesPlaceholder}
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
                      {t.collapse}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNotesExpanded(true)}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {t.addNotes}
                  </button>
                )}

                {selected && (
                  <p className="text-xs text-gray-400">
                    {effectiveService?.name} {t.atTime} {formatTime(selected.start)}
                  </p>
                )}

                {showRecurringOption && selected ? (
                  <div
                    className="border border-gray-700 rounded-lg p-4 mt-2 space-y-3"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-white text-sm">{rc.makeRecurring}</h4>
                        <p className="text-gray-400 text-xs mt-0.5">{rc.recurringDescription}</p>
                      </div>
                      <Switch
                        checked={recurringEnabled}
                        onCheckedChange={setRecurringEnabled}
                        className="shrink-0"
                      />
                    </div>
                    {recurringEnabled ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label htmlFor="rec-freq" className="block text-sm text-gray-400 mb-1">
                            {rc.frequency}
                          </label>
                          <select
                            id="rec-freq"
                            value={recurringFrequency}
                            onChange={(e) => setRecurringFrequency(e.target.value)}
                            className="w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm min-h-[44px]"
                          >
                            <option value="weekly">{rc.everyWeek}</option>
                            <option value="biweekly">{rc.every2Weeks}</option>
                            <option value="monthly">{rc.everyMonth}</option>
                            <option value="custom">{rc.custom}</option>
                          </select>
                        </div>
                        {recurringFrequency === 'custom' ? (
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[120px]">
                              <label htmlFor="rec-int" className="block text-sm text-gray-400 mb-1">
                                {rc.every}
                              </label>
                              <Input
                                id="rec-int"
                                type="number"
                                min={1}
                                max={90}
                                value={recurringIntervalDays}
                                onChange={(e) =>
                                  setRecurringIntervalDays(
                                    Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1))
                                  )
                                }
                                className="bg-gray-800 border-gray-700 text-white"
                              />
                            </div>
                            <span className="text-sm text-gray-400 pb-2">{rc.days}</span>
                          </div>
                        ) : null}
                        <div>
                          <label htmlFor="rec-count" className="block text-sm text-gray-400 mb-1">
                            {rc.howMany}
                          </label>
                          <select
                            id="rec-count"
                            value={recurringTotalOccurrences}
                            onChange={(e) => setRecurringTotalOccurrences(Number(e.target.value))}
                            className="w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm min-h-[44px]"
                          >
                            {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                              <option key={n} value={n}>
                                {n} {rc.appointments}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-gray-500 text-xs">{rc.recurringNote}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  onClick={() => {
                    if (needsCardStep) {
                      if (!canSubmit) return
                      setBookingSubStep('card')
                    } else {
                      handleBooking()
                    }
                  }}
                  disabled={!canSubmit}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white h-12 text-base font-medium"
                >
                  {booking ? (
                    <>
                      <Loader2 className="w-4 h-4 me-2 animate-spin" />
                      {t.confirming}
                    </>
                  ) : needsCardStep ? (
                    t.noShow.continueToCard
                  ) : (
                    t.confirmBooking
                  )}
                </Button>
                  </>
                ) : (
                  <StripeCardStep
                    handle={handle}
                    email={(form.email || '').trim()}
                    name={(form.name || '').trim()}
                    t={t}
                    noShowProtection={noShowProtection}
                    feeDisplay={noShowFeeDisplay}
                    publishableKey={stripePublishableKey}
                    onSuccess={({ setupIntentId }) => handleBooking(setupIntentId)}
                    onBack={() => setBookingSubStep('details')}
                    disabled={booking}
                  />
                )}

                {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              </div>
            </div>
            ) : (
              <div className="sticky top-4 flex items-center justify-center min-h-[200px] text-gray-500 text-sm border border-dashed border-gray-700 rounded-xl">
                {t.selectTime}
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="max-w-6xl mx-auto px-4 md:px-6 pb-10 pt-2 text-center text-xs text-gray-500">
        {publicBookingPhone ? (
          <p>
            {businessMultilingual ? (
              <>
                {t.footerAiAndPhone}{' '}
                <span className="text-gray-400">
                  {t.footerOrCallText}{' '}
                  <span className="text-gray-300 font-medium">{publicBookingPhone}</span>
                </span>
              </>
            ) : (
              <span className="text-gray-400">
                {t.footerOrCallText} <span className="text-gray-300 font-medium">{publicBookingPhone}</span>
              </span>
            )}
          </p>
        ) : (
          <p>
            {businessMultilingual ? t.footerAiOnly : t.footerBookOnline}
          </p>
        )}
      </footer>
    </main>
  )
}
