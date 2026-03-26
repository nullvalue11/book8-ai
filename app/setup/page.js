'use client'

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
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
  Sparkles,
  Zap,
  Building2
} from 'lucide-react'
import TimeZonePicker from '@/components/TimeZonePicker'

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

function getServiceName(svc) {
  return svc?.name || svc?.serviceName || svc?.title || svc?.label || svc?.displayName || 'Service'
}

function getServiceDuration(svc) {
  return svc?.durationMinutes ?? svc?.duration ?? 30
}

function formatPhone(num) {
  if (!num || typeof num !== 'string') return null
  const digits = num.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return num
}

function SetupAuthScreen({ onAuthenticated }) {
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [authMode, setAuthMode] = useState('login')
  const [formError, setFormError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin() {
    if (!formData.email || !formData.password) {
      setFormError('Please enter both email and password')
      return
    }
    try {
      setFormError('')
      setIsLoading(true)
      const res = await fetch('/api/credentials/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('book8_token', data.token)
      localStorage.setItem('book8_user', JSON.stringify(data.user))
      onAuthenticated?.()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRegister() {
    if (!formData.email || !formData.password) {
      setFormError('Please enter both email and password')
      return
    }
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters')
      return
    }
    try {
      setFormError('')
      setIsLoading(true)
      const res = await fetch('/api/credentials/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name || ''
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      localStorage.setItem('book8_token', data.token)
      localStorage.setItem('book8_user', JSON.stringify(data.user))
      onAuthenticated?.()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-8 shadow-xl">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">Get Started with Book8 AI</h1>
            <p className="text-[#94A3B8] text-sm">
              Create your AI receptionist in under 5 minutes.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 px-4 rounded-lg bg-white hover:bg-gray-50 text-gray-900 border-gray-200 font-medium"
              onClick={async () => {
                setIsLoading(true)
                try {
                  await signIn('google', {
                    callbackUrl: '/auth/oauth-callback?redirect=%2Fsetup',
                    redirect: true
                  })
                } catch (err) {
                  setFormError('Failed to initiate Google sign-in.')
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 px-4 rounded-lg bg-white hover:bg-gray-50 text-gray-900 border-gray-200 font-medium"
              onClick={async () => {
                setIsLoading(true)
                try {
                  await signIn('azure-ad', {
                    callbackUrl: '/auth/oauth-callback?redirect=%2Fsetup',
                    redirect: true
                  })
                } catch (err) {
                  setFormError('Failed to initiate Microsoft sign-in.')
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23">
                <path fill="#f3f3f3" d="M0 0h23v23H0z" />
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Continue with Microsoft
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gray-900/50 text-gray-500">or continue with email</span>
            </div>
          </div>

          <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${authMode === 'login' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => { setAuthMode('login'); setFormError('') }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${authMode === 'register' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => { setAuthMode('register'); setFormError('') }}
            >
              Register
            </button>
          </div>

          <div className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="setup-name" className="text-sm font-medium text-gray-300 block">
                  Name
                </Label>
                <Input
                  id="setup-name"
                  className="w-full h-11 bg-gray-900 border-gray-700 text-white rounded-lg placeholder:text-gray-500"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="setup-email" className="text-sm font-medium text-gray-300 block">
                Email
              </Label>
              <Input
                id="setup-email"
                type="email"
                className="w-full h-11 bg-gray-900 border-gray-700 text-white rounded-lg placeholder:text-gray-500"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup-password" className="text-sm font-medium text-gray-300 block">
                Password
              </Label>
              <Input
                id="setup-password"
                type="password"
                className="w-full h-11 bg-gray-900 border-gray-700 text-white rounded-lg placeholder:text-gray-500"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
              {authMode === 'register' && (
                <p className="text-xs text-gray-500">Must be at least 6 characters</p>
              )}
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">{formError}</p>
            </div>
          )}

          <Button
            className="w-full h-12 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium"
            onClick={authMode === 'login' ? handleLogin : handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </div>
      </div>
    </main>
  )
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
  const [planPriceIds, setPlanPriceIds] = useState({
    starter: null,
    growth: null,
    enterprise: null
  })
  /** Step 6 only: idle | loading | live | provisioning | error — avoids relying on core during Steps 1–5 */
  const [step6LineState, setStep6LineState] = useState('idle')
  const [step6RetryKey, setStep6RetryKey] = useState(0)
  const [step2CheckoutPhase, setStep2CheckoutPhase] = useState('choose')
  const trialChargeDateLabel = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }, [])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [bookingHost, setBookingHost] = useState('book8.io')

  // Auth token
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const t = localStorage.getItem('book8_token')
      setToken(t)
      setBookingHost(window.location.host || 'book8.io')
    }
    setAppReady(true)
  }, [])

  // Detect timezone on mount
  useEffect(() => {
    if (typeof Intl !== 'undefined') {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setWizardData((prev) => (prev.timezone ? prev : { ...prev, timezone: tz }))
    }
  }, [])

  useEffect(() => {
    if (currentStep !== 2) setStep2CheckoutPhase('choose')
  }, [currentStep])

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
      if (plansRes.ok && plansData.plans) {
        setPlanPriceIds({
          starter: plansData.plans.starter ?? null,
          growth: plansData.plans.growth ?? null,
          enterprise: plansData.plans.enterprise ?? null
        })
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

  // Step 6 only: poll phone-setup from core (lazy; graceful when business not provisioned yet)
  useEffect(() => {
    if (currentStep !== 6) {
      setStep6LineState('idle')
      return
    }
    if (!token || !wizardData.businessId) return

    if (wizardData.phoneNumber) {
      setStep6LineState('live')
      return
    }

    let cancelled = false
    let intervalId = null
    let pollCount = 0
    const maxPolls = 24
    let firstPhoneFetch = true

    const clearPoll = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const fetchPhoneLine = async () => {
      try {
        setStep6LineState((prev) => {
          if (prev === 'live') return 'live'
          if (!firstPhoneFetch && prev === 'provisioning') return 'provisioning'
          return 'loading'
        })
        const r = await fetch(
          `/api/business/phone-setup?businessId=${encodeURIComponent(wizardData.businessId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
        )
        let data = {}
        try {
          data = await r.json()
        } catch {
          data = {}
        }
        if (cancelled) return
        firstPhoneFetch = false

        if (!r.ok || !data.ok) {
          setStep6LineState('error')
          clearPoll()
          return
        }

        const num = data.assignedTwilioNumber ?? data.phoneNumber ?? null
        if (num) {
          setWizardData((prev) => ({ ...prev, phoneNumber: num }))
          setStep6LineState('live')
          clearPoll()
          return
        }

        setStep6LineState('provisioning')
      } catch {
        firstPhoneFetch = false
        if (!cancelled) {
          setStep6LineState('error')
          clearPoll()
        }
      }
    }

    fetchPhoneLine()

    intervalId = setInterval(() => {
      if (cancelled) return
      pollCount += 1
      if (pollCount >= maxPolls) {
        clearPoll()
        return
      }
      fetchPhoneLine()
    }, 15000)

    return () => {
      cancelled = true
      clearPoll()
    }
  }, [currentStep, token, wizardData.businessId, wizardData.phoneNumber, step6RetryKey])

  // Step 6: load handle from our DB only (no core-api)
  useEffect(() => {
    if (currentStep !== 6 || !token || !wizardData.businessId) return
    if (wizardData.bookingHandle || wizardData.handle) return

    ;(async () => {
      try {
        const r = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await r.json()
        if (!r.ok || !data.ok || !data.businesses?.length) return
        const biz =
          data.businesses.find((b) => b.businessId === wizardData.businessId) || data.businesses[0]
        const h = biz.handle ?? biz.bookingHandle ?? null
        if (h) setWizardData((prev) => ({ ...prev, handle: h, bookingHandle: h }))
      } catch {
        /* ignore */
      }
    })()
  }, [currentStep, token, wizardData.businessId, wizardData.handle, wizardData.bookingHandle])

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
  function handleStep2Submit(priceId) {
    if (!priceId || !wizardData.businessId) {
      setError('Plan or business not available')
      return
    }
    setSaving(true)
    setError('')
    setStep2CheckoutPhase('choose')
    fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        priceId,
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

  // Step 5: Services - load and continue (try handle first, then businessId as fallback)
  useEffect(() => {
    if (currentStep !== 5 || servicesLoaded) return
    const loadServices = async () => {
      try {
        if (wizardData.handle) {
          const r = await fetch(`/api/public/services?handle=${encodeURIComponent(wizardData.handle)}`, { cache: 'no-store' })
          const data = await r.json()
          if (data.ok && Array.isArray(data.services)) {
            console.log('[setup] Services loaded:', JSON.stringify(data.services))
            setWizardData((prev) => ({ ...prev, services: data.services }))
            setServicesLoaded(true)
            return
          }
        }
        if (wizardData.businessId) {
          const r = await fetch(`/api/business/${wizardData.businessId}/services`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          })
          const data = await r.json()
          const services = data.services ?? (Array.isArray(data) ? data : [])
          if (Array.isArray(services)) {
            console.log('[setup] Services loaded:', JSON.stringify(services))
            setWizardData((prev) => ({ ...prev, services }))
          }
        }
      } catch (err) {
        console.error('[setup] Failed to load services:', err)
      } finally {
        setServicesLoaded(true)
      }
    }
    loadServices()
  }, [currentStep, wizardData.handle, wizardData.businessId, servicesLoaded, token])

  function handleStep5Submit() {
    setCurrentStep(6)
    setStep6LineState('idle')
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

  // Show sign-in form when not logged in (Option A: keep user on setup page)
  if (!token) {
    return <SetupAuthScreen onAuthenticated={() => {
      const t = localStorage.getItem('book8_token')
      setToken(t)
    }} />
  }

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
                  <TimeZonePicker
                    value={wizardData.timezone}
                    onChange={(tz) => updateWizard({ timezone: tz })}
                    className="[&_label]:text-[#F8FAFC]"
                    selectClassName="bg-[#0A0A0F] border-[#1e1e2e] text-white"
                    inputClassName="bg-[#0A0A0F] border-[#1e1e2e] text-white"
                    idPrefix="setup-wizard"
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
              <p className="text-[#94A3B8] mt-1">
                Compare Starter, Growth, and Enterprise. Growth includes a 14-day free trial — card required at checkout;
                you won&apos;t be charged until the trial ends.
              </p>
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
            ) : step2CheckoutPhase === 'confirm' ? (
              <Card className="border-[#8B5CF6]/40 bg-[#12121A] max-w-xl mx-auto">
                <CardContent className="pt-6 space-y-4">
                  <p className="text-white font-semibold">You&apos;re starting a 14-day free trial of the Growth plan.</p>
                  <ul className="text-sm text-[#94A3B8] space-y-2 list-disc pl-5">
                    <li>Full access to all features immediately</li>
                    <li>
                      Your card is required but won&apos;t be charged until{' '}
                      <span className="text-[#F8FAFC] font-medium">{trialChargeDateLabel}</span>
                    </li>
                    <li>Cancel anytime before then and pay nothing</li>
                  </ul>
                  <p className="text-xs text-[#64748B]">💳 Card required for verification. No charge for 14 days.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="border-[#1e1e2e] text-[#94A3B8] hover:text-white"
                      onClick={() => setStep2CheckoutPhase('choose')}
                      disabled={saving}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                      onClick={() => handleStep2Submit(planPriceIds.growth)}
                      disabled={saving || !planPriceIds.growth}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue to Checkout
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 md:items-center">
                {/* Starter */}
                <Card className="border-[#1e1e2e] bg-[#12121A] order-1 md:order-1 h-full flex flex-col">
                  <CardContent className="pt-6 flex flex-col flex-1 space-y-4">
                    <div className="rounded-lg border border-[#1e1e2e] p-4 bg-[#0A0A0F] flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-5 h-5 text-[#06B6D4]" />
                        <span className="font-semibold text-white">Starter</span>
                      </div>
                      <p className="text-lg font-semibold text-white mb-1">$29/mo</p>
                      <p className="text-xs text-[#64748B] mb-3">Billed monthly</p>
                      <ul className="text-sm text-[#94A3B8] space-y-1.5">
                        <li>✓ Calendar sync &amp; booking page</li>
                        <li>✓ Email reminders</li>
                        <li>✓ Core analytics</li>
                        <li>✓ Metered call minutes</li>
                      </ul>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-[#2a2a3d] bg-[#0A0A0F] text-white hover:bg-[#1e1e2e]"
                      onClick={() => handleStep2Submit(planPriceIds.starter)}
                      disabled={saving || !planPriceIds.starter}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Growth — center, visually prominent */}
                <Card className="border-2 border-[#8B5CF6]/70 bg-[#12121A] order-2 md:order-2 h-full flex flex-col shadow-[0_0_48px_-12px_rgba(139,92,246,0.55)] md:scale-[1.07] z-10 relative">
                  <CardContent className="pt-6 flex flex-col flex-1 space-y-4">
                    <div className="rounded-lg border border-[#8B5CF6]/35 p-4 bg-[#0A0A0F] relative overflow-hidden flex-1">
                      <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wide text-[#A78BFA] bg-[#8B5CF6]/25 px-2 py-0.5 rounded">
                        14-day trial
                      </span>
                      <div className="flex items-center gap-2 mb-2 pr-14">
                        <Package className="w-5 h-5 text-[#8B5CF6]" />
                        <span className="font-semibold text-white">Growth</span>
                      </div>
                      <p className="text-xs font-medium text-[#A78BFA] mb-1">Most popular</p>
                      <p className="text-sm text-[#94A3B8] mb-1">Start your 14-day free trial</p>
                      <p className="text-lg font-semibold text-white mb-3">$99/mo after trial</p>
                      <ul className="text-sm text-[#94A3B8] space-y-1">
                        <li>✓ Everything in Starter</li>
                        <li>✓ AI voice booking 24/7</li>
                        <li>✓ Multi-calendar &amp; SMS</li>
                        <li>✓ Up to 5 businesses</li>
                      </ul>
                    </div>
                    <Button
                      className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                      onClick={() => setStep2CheckoutPhase('confirm')}
                      disabled={saving || !planPriceIds.growth}
                    >
                      Start Free Trial
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <p className="text-[10px] text-[#64748B] text-center leading-snug">
                      No charge for 14 days. Cancel anytime. Card required.
                    </p>
                  </CardContent>
                </Card>

                {/* Enterprise */}
                <Card className="border-[#1e1e2e] bg-[#12121A] order-3 md:order-3 h-full flex flex-col">
                  <CardContent className="pt-6 flex flex-col flex-1 space-y-4">
                    <div className="rounded-lg border border-[#1e1e2e] p-4 bg-[#0A0A0F] flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-amber-500/90" />
                        <span className="font-semibold text-white">Enterprise</span>
                      </div>
                      <p className="text-lg font-semibold text-white mb-1">$299/mo</p>
                      <p className="text-xs text-[#64748B] mb-3">Billed monthly</p>
                      <ul className="text-sm text-[#94A3B8] space-y-1.5">
                        <li>✓ Everything in Growth</li>
                        <li>✓ Advanced seat &amp; org needs</li>
                        <li>✓ Priority support</li>
                        <li>✓ SLA &amp; custom options</li>
                      </ul>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full border-[#2a2a3d] bg-[#0A0A0F] text-white hover:bg-[#1e1e2e]"
                      onClick={() => handleStep2Submit(planPriceIds.enterprise)}
                      disabled={saving || !planPriceIds.enterprise}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
                {!servicesLoaded ? (
                  <p className="text-[#94A3B8] text-sm">Loading services...</p>
                ) : wizardData.services.length === 0 ? (
                  <p className="text-[#94A3B8] text-sm">
                    No services found. Default services will be created when your AI agent is set up. You can customize them from your dashboard.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {wizardData.services.map((svc, i) => (
                      <li
                        key={svc.serviceId || svc.id || i}
                        className="flex items-center gap-3 rounded-lg border border-[#1e1e2e] px-4 py-3"
                      >
                        <Input
                          className="flex-1 bg-[#0A0A0F] border-[#1e1e2e] text-white min-w-0"
                          placeholder="Service name"
                          value={getServiceName(svc)}
                          readOnly
                        />
                        <span className="text-[#64748B] text-sm shrink-0">{getServiceDuration(svc)} min</span>
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
                  {wizardData.phoneNumber ? (
                    <>
                      <p className="text-xl font-mono text-white">
                        {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber}
                      </p>
                      <p className="text-sm text-[#94A3B8] mt-1">
                        Customers can call or text this number to book appointments.
                      </p>
                    </>
                  ) : step6LineState === 'error' ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-2">
                      <p className="text-sm text-red-200">
                        Couldn&apos;t load your line from our systems yet. You can try again, or continue from the
                        dashboard later.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-500/40 text-red-200 hover:bg-red-500/20"
                        onClick={() => setStep6RetryKey((k) => k + 1)}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-4 flex items-start gap-3">
                      <Loader2 className="w-5 h-5 text-[#8B5CF6] shrink-0 animate-spin mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-white">Setting up your phone line…</p>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          Provisioning can take a minute after checkout. We&apos;ll check automatically every 15 seconds
                          until your number is ready.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[#8B5CF6] mb-2">
                    <Globe className="w-5 h-5" />
                    <span className="font-semibold">Your Booking Page</span>
                  </div>
                  <p className="text-lg font-mono text-white break-all">
                    {bookingHost}/b/{wizardData.bookingHandle || wizardData.handle || 'your-business'}
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
