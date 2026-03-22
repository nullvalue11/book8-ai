'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertTriangle,
  Phone,
  Globe,
  Copy,
  Calendar,
  Clock,
  Package,
  Sparkles
} from 'lucide-react'

const CATEGORIES = [
  { value: 'barber', label: 'Barber' },
  { value: 'dental', label: 'Dental' },
  { value: 'spa', label: 'Spa' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'medical', label: 'Medical' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'other', label: 'Other' }
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun'
}

const TIME_OPTIONS = (() => {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return opts
})()

const DEFAULT_HOURS = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: []
}

const STEP_LABELS = [
  'Business',
  'Plan',
  'Calendar',
  'Hours',
  'Services',
  'Live!'
]

function emptyWeeklyHours() {
  return DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {})
}

function WizardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState(null)
  const [appReady, setAppReady] = useState(false)

  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState({
    businessName: '',
    category: 'other',
    city: '',
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Toronto',
    businessId: null,
    handle: null,
    planActive: false,
    calendarConnected: false,
    calendarProvider: null,
    calendarSkipped: false,
    businessHours: { ...DEFAULT_HOURS },
    services: [],
    phoneNumber: null,
    bookingHandle: null
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [growthPriceId, setGrowthPriceId] = useState(null)

  // Auth token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('book8_token')
      setToken(t)
    }
    setAppReady(true)
  }, [])

  // Redirect if not logged in
  useEffect(() => {
    if (appReady && !token) {
      router.push('/?redirect=/setup')
    }
  }, [appReady, token, router])

  // Detect timezone on mount
  useEffect(() => {
    if (typeof Intl !== 'undefined') {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setWizardData((prev) => (prev.timezone ? prev : { ...prev, timezone: tz }))
    }
  }, [])

  // Load existing state for returning users
  const loadInitialState = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const bizRes = await fetch('/api/business/register', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const bizData = await bizRes.json()
      if (!bizRes.ok || !bizData.ok) {
        throw new Error(bizData.error || 'Failed to load businesses')
      }
      const bizList = bizData.businesses || []
      setBusinesses(bizList)

      if (bizList.length > 0) {
        const primary = bizList[0]
        const planActive =
          primary.subscription?.status === 'active' ||
          primary.subscription?.status === 'trialing' ||
          ['starter', 'growth', 'enterprise'].includes(primary.plan)
        const calendarConnected = primary.calendar?.connected || false
        const calendarProvider = primary.calendar?.provider || null

        let step = 1
        if (primary.businessId && primary.name) {
          setWizardData((prev) => ({
            ...prev,
            businessId: primary.businessId,
            handle: primary.handle,
            businessName: primary.name,
            category: primary.category || 'other',
            planActive,
            calendarConnected,
            calendarProvider
          }))
          step = 2
        }
        if (planActive) step = 3
        if (calendarConnected || calendarProvider) step = 4

        // Check if we have phone setup and schedule
        const setupRes = await fetch(
          `/api/business/phone-setup?businessId=${encodeURIComponent(primary.businessId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
        )
        const setupData = await setupRes.json()
        if (setupRes.ok && setupData.ok && setupData.assignedTwilioNumber) {
          step = 6
          setWizardData((prev) => ({
            ...prev,
            phoneNumber: setupData.assignedTwilioNumber,
            bookingHandle: primary.handle
          }))
        } else if (step === 4) {
          const schedRes = await fetch(`/api/business/${primary.businessId}/schedule`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          })
          const schedData = await schedRes.json()
          if (schedRes.ok && schedData.ok && schedData.schedule?.weeklyHours) {
            step = 5
          }
        }

        const urlStep = searchParams.get('step')
        if (urlStep) {
          const s = parseInt(urlStep, 10)
          if (s >= 1 && s <= 6) step = s
        }

        setCurrentStep(step)
      }

      // Load plans for step 2
      const plansRes = await fetch('/api/billing/plans', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const plansData = await plansRes.json()
      if (plansRes.ok && plansData.plans?.growth) {
        setGrowthPriceId(plansData.plans.growth)
      }
    } catch (err) {
      console.error('[setup] Load error', err)
      setError(err.message || 'Failed to load setup')
    } finally {
      setLoading(false)
    }
  }, [token, searchParams])

  useEffect(() => {
    loadInitialState()
  }, [loadInitialState])

  // Handle return from OAuth or checkout
  useEffect(() => {
    const googleConnected = searchParams.get('google_connected')
    const outlookConnected = searchParams.get('outlook_connected')
    const checkoutSuccess = searchParams.get('checkout') === 'success'
    const bizId = searchParams.get('businessId')
    if ((googleConnected || outlookConnected || checkoutSuccess) && bizId && wizardData.businessId === bizId) {
      loadInitialState()
    }
  }, [searchParams, wizardData.businessId, loadInitialState])

  const updateWizard = (updates) => {
    setWizardData((prev) => ({ ...prev, ...updates }))
    setError('')
  }

  // Step 1: Business info
  async function handleStep1Submit() {
    if (!wizardData.businessName?.trim()) {
      setError('Business name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const regRes = await fetch('/api/business/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: wizardData.businessName.trim(),
          category: wizardData.category,
          timezone: wizardData.timezone
        })
      })
      const regData = await regRes.json()
      if (!regRes.ok || !regData.ok) {
        throw new Error(regData.error || 'Failed to register business')
      }
      updateWizard({ businessId: regData.businessId })
      const refetchRes = await fetch('/api/business/register', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const refetchData = await refetchRes.json()
      if (refetchRes.ok && refetchData.businesses?.length) {
        const biz = refetchData.businesses.find((b) => b.businessId === regData.businessId) || refetchData.businesses[0]
        updateWizard({ handle: biz.handle })
      }
      // Call confirm to provision
      const confirmRes = await fetch('/api/business/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: regData.businessId })
      })
      const confirmData = await confirmRes.json()
      if (confirmRes.ok && confirmData.ok) {
        setCurrentStep(2)
      } else if (confirmData.error?.includes('billing') || confirmData.error?.includes('subscription')) {
        setCurrentStep(2)
      } else if (!confirmRes.ok) {
        console.warn('[setup] Confirm returned:', confirmData)
        setCurrentStep(2)
      } else {
        setCurrentStep(2)
      }
    } catch (err) {
      setError(err.message || 'Failed to register')
    } finally {
      setSaving(false)
    }
  }

  // Step 2: Plan selection -> Stripe checkout
  function handleStep2Submit() {
    if (!growthPriceId || !wizardData.businessId) {
      setError('Plan or business not available')
      return
    }
    setSaving(true)
    setError('')
    fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        priceId: growthPriceId,
        businessId: wizardData.businessId
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl
        } else {
          setError(data.error || 'Checkout failed')
          setSaving(false)
        }
      })
      .catch((err) => {
        setError(err.message || 'Checkout failed')
        setSaving(false)
      })
  }

  function handleStep2Skip() {
    setCurrentStep(3)
  }

  // Step 3: Calendar connect
  function handleConnectGoogle() {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/api/integrations/google/auth?businessId=${encodeURIComponent(wizardData.businessId)}&jwt=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(`${base}/setup?step=4&businessId=${wizardData.businessId}`)}`
    window.location.href = url
  }

  function handleConnectOutlook() {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${base}/api/integrations/microsoft/auth?businessId=${encodeURIComponent(wizardData.businessId)}&jwt=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(`${base}/setup?step=4&businessId=${wizardData.businessId}`)}`
    window.location.href = url
  }

  function handleStep3Skip() {
    updateWizard({ calendarSkipped: true })
    setCurrentStep(4)
  }

  // Step 4: Business hours
  function setDayOpen(day, open) {
    updateWizard({
      businessHours: {
        ...wizardData.businessHours,
        [day]: open ? [{ start: '09:00', end: '17:00' }] : []
      }
    })
  }

  function setDayBlock(day, index, field, value) {
    const hours = { ...wizardData.businessHours }
    const blocks = [...(hours[day] || [])]
    if (!blocks[index]) blocks[index] = { start: '09:00', end: '17:00' }
    blocks[index] = { ...blocks[index], [field]: value }
    hours[day] = blocks
    updateWizard({ businessHours: hours })
  }

  function applyWeekdaysSame() {
    const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    const template = [{ start: '09:00', end: '17:00' }]
    const hours = { ...wizardData.businessHours }
    weekdays.forEach((d) => { hours[d] = [...template] })
    updateWizard({ businessHours: hours })
  }

  async function handleStep4Submit() {
    if (!wizardData.businessId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/business/${wizardData.businessId}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          timezone: wizardData.timezone,
          weeklyHours: wizardData.businessHours
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save hours')
      setCurrentStep(5)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Step 5: Services - load and continue
  useEffect(() => {
    if (currentStep === 5 && wizardData.handle && !wizardData.services?.length) {
      fetch(`/api/public/services?handle=${encodeURIComponent(wizardData.handle)}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && Array.isArray(data.services)) {
            setWizardData((prev) => ({ ...prev, services: data.services }))
          }
        })
        .catch(() => {})
    }
  }, [currentStep, wizardData.handle, wizardData.services?.length])

  function handleStep5Submit() {
    setCurrentStep(6)
    if (wizardData.businessId) {
      fetch(`/api/business/phone-setup?businessId=${encodeURIComponent(wizardData.businessId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            updateWizard({
              phoneNumber: data.assignedTwilioNumber,
              bookingHandle: wizardData.handle
            })
          }
        })
        .catch(() => {})
    }
  }

  function handleGoToDashboard() {
    router.push('/dashboard')
  }

  function copyBookingLink() {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${base}/b/${wizardData.bookingHandle || wizardData.handle || 'your-business'}`
    navigator.clipboard?.writeText(link)
  }

  const isDayOpen = (day) => (wizardData.businessHours[day] || []).length > 0

  if (!appReady || (token && loading)) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6]" />
      </main>
    )
  }

  if (!token) return null

  const progressPct = (currentStep / 6) * 100

  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            {STEP_LABELS.map((label, i) => (
              <div
                key={i}
                className={`flex flex-col items-center min-w-0 ${i + 1 <= currentStep ? 'text-[#8B5CF6]' : 'text-[#64748B]'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    i + 1 < currentStep
                      ? 'bg-[#8B5CF6] text-white'
                      : i + 1 === currentStep
                        ? 'bg-[#8B5CF6] text-white ring-2 ring-[#8B5CF6]/50 ring-offset-2 ring-offset-[#0A0A0F]'
                        : 'bg-[#1e1e2e] text-[#64748B]'
                  }`}
                >
                  {i + 1 < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-[10px] mt-1 hidden sm:block truncate max-w-full">{label}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Step 1: Business info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Welcome to Book8 AI! 👋</h1>
              <p className="text-[#94A3B8] mt-1">
                Let&apos;s set up your AI receptionist in under 5 minutes.
              </p>
            </div>
            <Card className="border-[#1e1e2e] bg-[#12121A]">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-[#F8FAFC]">Business name *</Label>
                  <Input
                    className="bg-[#0A0A0F] border-[#1e1e2e] text-white mt-1"
                    placeholder="e.g. Ottawa Dental Clinic"
                    value={wizardData.businessName}
                    onChange={(e) => updateWizard({ businessName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[#F8FAFC]">Category *</Label>
                  <Select
                    value={wizardData.category}
                    onValueChange={(v) => updateWizard({ category: v })}
                  >
                    <SelectTrigger className="bg-[#0A0A0F] border-[#1e1e2e] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12121A] border-[#1e1e2e]">
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className="text-white">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[#F8FAFC]">City (optional)</Label>
                  <Input
                    className="bg-[#0A0A0F] border-[#1e1e2e] text-white mt-1"
                    placeholder="e.g. Ottawa"
                    value={wizardData.city}
                    onChange={(e) => updateWizard({ city: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-[#F8FAFC]">Timezone</Label>
                  <Input
                    className="bg-[#0A0A0F] border-[#1e1e2e] text-white mt-1"
                    value={wizardData.timezone}
                    onChange={(e) => updateWizard({ timezone: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white mt-4"
                  onClick={handleStep1Submit}
                  disabled={saving || !wizardData.businessName?.trim()}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Plan selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Choose your plan</h1>
              <p className="text-[#94A3B8] mt-1">Start with a 14-day free trial. No credit card required.</p>
            </div>
            {wizardData.planActive ? (
              <Card className="border-[#1e1e2e] bg-[#12121A]">
                <CardContent className="pt-6">
                  <p className="text-[#94A3B8] mb-4">You already have an active plan. Continue to the next step.</p>
                  <Button
                    className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                    onClick={() => setCurrentStep(3)}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-[#1e1e2e] bg-[#12121A]">
                <CardContent className="pt-6 space-y-4">
                  <div className="rounded-lg border border-[#1e1e2e] p-4 bg-[#0A0A0F]">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 text-[#8B5CF6]" />
                      <span className="font-semibold text-white">Growth — $99/mo</span>
                    </div>
                    <ul className="text-sm text-[#94A3B8] space-y-1">
                      <li>✓ AI voice booking 24/7</li>
                      <li>✓ SMS booking</li>
                      <li>✓ Online booking page</li>
                      <li>✓ Google & Outlook calendar sync</li>
                      <li>✓ Unlimited bookings</li>
                      <li>✓ Up to 5 businesses</li>
                    </ul>
                  </div>
                  <Button
                    className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                    onClick={handleStep2Submit}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Start 14-day Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <p className="text-xs text-[#64748B] text-center">No credit card required for trial</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 3: Calendar connect */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Connect your calendar</h1>
              <p className="text-[#94A3B8] mt-1">
                We&apos;ll check your availability in real-time and add bookings directly to your calendar.
              </p>
            </div>
            <Card className="border-[#1e1e2e] bg-[#12121A]">
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-14 border-[#1e1e2e] bg-[#0A0A0F] text-white hover:bg-[#1e1e2e]"
                    onClick={handleConnectGoogle}
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    Gmail
                  </Button>
                  <Button
                    variant="outline"
                    className="h-14 border-[#1e1e2e] bg-[#0A0A0F] text-white hover:bg-[#1e1e2e]"
                    onClick={handleConnectOutlook}
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    Outlook
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-[#94A3B8] hover:text-white"
                  onClick={handleStep3Skip}
                >
                  Skip for now
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Business hours */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">When is your business open?</h1>
              <p className="text-[#94A3B8] mt-1">Set your weekly availability. You can change this anytime.</p>
            </div>
            <Card className="border-[#1e1e2e] bg-[#12121A]">
              <CardContent className="pt-6 space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#1e1e2e] text-[#94A3B8] hover:text-white"
                  onClick={applyWeekdaysSame}
                >
                  Apply same hours to all weekdays
                </Button>
                <div className="space-y-3">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-3 flex-wrap">
                      <div className="w-12 text-sm text-[#94A3B8]">{DAY_LABELS[day]}</div>
                      <Switch
                        checked={isDayOpen(day)}
                        onCheckedChange={(open) => setDayOpen(day, open)}
                        className="data-[state=checked]:bg-[#8B5CF6]"
                      />
                      {isDayOpen(day) && (
                        <>
                          <select
                            className="h-9 rounded-md border border-[#1e1e2e] bg-[#0A0A0F] text-white text-sm px-2"
                            value={wizardData.businessHours[day]?.[0]?.start || '09:00'}
                            onChange={(e) => setDayBlock(day, 0, 'start', e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <span className="text-[#64748B]">—</span>
                          <select
                            className="h-9 rounded-md border border-[#1e1e2e] bg-[#0A0A0F] text-white text-sm px-2"
                            value={wizardData.businessHours[day]?.[0]?.end || '17:00'}
                            onChange={(e) => setDayBlock(day, 0, 'end', e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </>
                      )}
                      {!isDayOpen(day) && <span className="text-[#64748B] text-sm">Closed</span>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="border-[#1e1e2e] text-[#94A3B8]"
                    onClick={() => setCurrentStep(3)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white flex-1"
                    onClick={handleStep4Submit}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 5: Services */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Your services</h1>
              <p className="text-[#94A3B8] mt-1">
                We&apos;ve created default services based on your category. Customize from your dashboard later.
              </p>
            </div>
            <Card className="border-[#1e1e2e] bg-[#12121A]">
              <CardContent className="pt-6 space-y-4">
                {wizardData.services.length === 0 ? (
                  <p className="text-[#94A3B8] text-sm">Loading services...</p>
                ) : (
                  <ul className="space-y-2">
                    {wizardData.services.map((svc, i) => (
                      <li
                        key={svc.id || i}
                        className="flex items-center justify-between rounded-lg border border-[#1e1e2e] px-3 py-2 text-sm"
                      >
                        <span className="text-white">{svc.name || svc.title || 'Service'}</span>
                        <span className="text-[#64748B]">{svc.durationMinutes || 30} min</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="border-[#1e1e2e] text-[#94A3B8]"
                    onClick={() => setCurrentStep(4)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white flex-1"
                    onClick={handleStep5Submit}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 6: You're Live! */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#8B5CF6]/20 mb-4">
                <Sparkles className="w-8 h-8 text-[#8B5CF6]" />
              </div>
              <h1 className="text-2xl font-bold text-white">You&apos;re Live! 🎉</h1>
              <p className="text-[#94A3B8] mt-1">Your AI receptionist is ready.</p>
            </div>
            <Card className="border-[#1e1e2e] bg-[#12121A]">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-[#8B5CF6] mb-2">
                    <Phone className="w-5 h-5" />
                    <span className="font-semibold">Your Booking Line</span>
                  </div>
                  <p className="text-xl font-mono text-white">
                    {wizardData.phoneNumber || '+1 (XXX) XXX-XXXX'}
                  </p>
                  <p className="text-sm text-[#94A3B8] mt-1">
                    Customers can call or text this number to book appointments.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[#8B5CF6] mb-2">
                    <Globe className="w-5 h-5" />
                    <span className="font-semibold">Your Booking Page</span>
                  </div>
                  <p className="text-lg font-mono text-white break-all">
                    book8.io/b/{wizardData.bookingHandle || wizardData.handle || 'your-business'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-[#1e1e2e] text-[#94A3B8]"
                    onClick={copyBookingLink}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
                <div className="rounded-lg bg-[#0A0A0F] border border-[#1e1e2e] p-4 text-sm text-[#94A3B8]">
                  <p className="font-medium text-white mb-2">Try it now!</p>
                  <ul className="space-y-1">
                    <li>→ Call your number to hear the AI agent</li>
                    <li>→ Text your number: &quot;Book a cleaning tomorrow at 2pm&quot;</li>
                    <li>→ Visit your booking page</li>
                  </ul>
                </div>
                <Button
                  className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                  onClick={handleGoToDashboard}
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0F]" />}>
      <WizardContent />
    </Suspense>
  )
}
