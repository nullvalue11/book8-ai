'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import Link from 'next/link'
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
  Building2,
  X,
  Plus,
  Lock,
  Minus,
  CreditCard
} from 'lucide-react'
import TimeZonePicker from '@/components/TimeZonePicker'
import { cn } from '@/lib/utils'
import { PRIMARY_LANGUAGE_OPTIONS } from '@/lib/primary-languages'
import { hasOutlookCalendar, normalizePlanKey } from '@/lib/plan-features'

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

const SERVICE_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]

function generateServiceDraftRowKey() {
  return `sr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateServiceIdForCore(name, durationMinutes) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'service'
  return `${slug}-${durationMinutes}-${Math.random().toString(36).slice(2, 8)}`
}

function getServicesContextLabel(category, customCategory) {
  if (category === 'other' && customCategory?.trim()) return customCategory.trim()
  const c = CATEGORIES.find((x) => x.value === category)
  return c?.label || 'Your business'
}

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
  'Phone',
  'Live!'
]

function emptyWeeklyHours() {
  return DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {})
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

function normalizeBusinessPhoneInput(value) {
  if (value == null || typeof value !== 'string') return value
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+') && cleaned.replace(/\D/g, '').length >= 7) {
    return cleaned
  }
  return value
}

function isInternationalBusinessPhoneValid(value) {
  if (value == null || typeof value !== 'string') return false
  const cleaned = value.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') && cleaned.replace(/\D/g, '').length >= 7
}

function SetupAuthScreen({ onAuthenticated, initialLoginMode = false }) {
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
            <h1 className="text-3xl font-bold text-white">
              {initialLoginMode ? 'Sign in' : 'Get Started with Book8 AI'}
            </h1>
            <p className="text-[#94A3B8] text-sm">
              {initialLoginMode
                ? 'Use your account to continue to your dashboard or setup.'
                : 'Create your AI receptionist in under 5 minutes.'}
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
              {authMode === 'login' && (
                <div className="text-right mt-1">
                  <Link
                    href="/reset-password/request"
                    className="text-sm text-[#A78BFA] hover:text-[#E9D5FF]"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
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

          {authMode === 'login' && (
            <p className="text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/setup" className="text-[#A78BFA] hover:text-[#E9D5FF] font-medium">
                Get started
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

function WizardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isLoginMode = searchParams.get('mode') === 'login'
  const [token, setToken] = useState(null)
  const [appReady, setAppReady] = useState(false)

  const [currentStep, setCurrentStep] = useState(1)
  const [wizardData, setWizardData] = useState({
    businessName: '',
    category: 'barber',
    customCategory: '',
    city: '',
    timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
    primaryLanguage: 'en',
    multilingualEnabled: true,
    businessId: null,
    handle: null,
    planActive: false,
    calendarConnected: false,
    calendarProvider: null,
    calendarSkipped: false,
    businessHours: { ...DEFAULT_HOURS },
    phoneNumber: null,
    book8Number: null,
    phoneSetup: null,
    existingBusinessNumber: null,
    bookingHandle: null,
    /** 'starter' | 'growth' | 'enterprise' — from business after checkout */
    subscriptionPlan: null
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
  /** Step 7 (You're Live): idle | loading | live | provisioning | error */
  const [step7LineState, setStep7LineState] = useState('idle')
  const [step7RetryKey, setStep7RetryKey] = useState(0)
  /** Step 6 (phone): pick | provisioning | new-ready | forward-ready | error */
  const [phoneStepPhase, setPhoneStepPhase] = useState('pick')
  const [phoneStepChoice, setPhoneStepChoice] = useState('new')
  const [phoneStepExistingInput, setPhoneStepExistingInput] = useState('')
  const [phoneStepSaving, setPhoneStepSaving] = useState(false)
  const [phoneStepPollKey, setPhoneStepPollKey] = useState(0)
  /** Tracks last step index so we detect entering Step 6 (choice always starts at pick). */
  const phoneStepPrevRef = useRef(null)
  const [step2CheckoutPhase, setStep2CheckoutPhase] = useState('choose')
  const trialChargeDateLabel = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  }, [])
  const [bookingHost, setBookingHost] = useState('book8.io')
  /** Step 5: core service IDs to remove when saving (e.g. provisioned defaults) */
  const [step5CoreServiceIds, setStep5CoreServiceIds] = useState([])
  const [step5Rows, setStep5Rows] = useState([
    { rowKey: generateServiceDraftRowKey(), name: '', durationMinutes: 30 }
  ])
  const [step5Ready, setStep5Ready] = useState(false)
  const step5ContinueState = useMemo(() => {
    if (!step5Ready) return { canContinue: false, hint: '' }
    if (saving) return { canContinue: false, hint: '' }
    const named = step5Rows.map((r) => r.name.trim()).filter(Boolean)
    if (named.length === 0) {
      return {
        canContinue: false,
        hint: 'Add at least one service with a name to continue.'
      }
    }
    const seen = new Set()
    for (const n of named) {
      const k = n.toLowerCase()
      if (seen.has(k)) {
        return { canContinue: false, hint: 'Each service name must be unique.' }
      }
      seen.add(k)
    }
    return { canContinue: true, hint: '' }
  }, [step5Ready, saving, step5Rows])

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

      const oauthResume =
        searchParams.get('google_connected') === '1' ||
        searchParams.get('outlook_connected') === '1'
      const registerNewBusiness =
        !oauthResume &&
        (searchParams.get('newBusiness') === '1' || searchParams.get('registerNew') === '1')

      if (bizList.length > 0 && registerNewBusiness) {
        const tz =
          typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'UTC'
        setWizardData((prev) => ({
          ...prev,
          businessId: null,
          handle: null,
          businessName: '',
          category: 'barber',
          customCategory: '',
          city: '',
          timezone: prev.timezone || tz,
          primaryLanguage: prev.primaryLanguage || 'en',
          multilingualEnabled: prev.multilingualEnabled !== false,
          planActive: false,
          calendarConnected: false,
          calendarProvider: null,
          calendarSkipped: false,
          businessHours: { ...DEFAULT_HOURS },
          phoneNumber: null,
          book8Number: null,
          phoneSetup: null,
          existingBusinessNumber: null,
          bookingHandle: null,
          subscriptionPlan: null
        }))
        setCurrentStep(1)
      } else if (bizList.length > 0) {
        const urlBizId = searchParams.get('businessId')
        let primary = bizList[0]
        if (urlBizId) {
          const match = bizList.find(
            (b) => b.businessId === urlBizId || b.id === urlBizId
          )
          if (match) primary = match
        }
        const planActive =
          primary.subscription?.status === 'active' ||
          primary.subscription?.status === 'trialing' ||
          ['starter', 'growth', 'enterprise'].includes(
            String(primary.plan || primary.subscription?.plan || '').toLowerCase()
          )
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
            customCategory: primary.customCategory || '',
            city: primary.city || prev.city || '',
            primaryLanguage: primary.primaryLanguage || prev.primaryLanguage || 'en',
            multilingualEnabled:
              primary.multilingualEnabled !== undefined
                ? primary.multilingualEnabled
                : prev.multilingualEnabled !== false,
            planActive,
            calendarConnected,
            calendarProvider,
            subscriptionPlan: normalizePlanKey(primary.plan || primary.subscription?.plan),
            phoneSetup: primary.phoneSetup ?? null,
            existingBusinessNumber: primary.existingBusinessNumber ?? null,
            book8Number: primary.book8Number ?? null
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
        let hasAssignedLine = false
        if (setupRes.ok && setupData.ok && setupData.assignedTwilioNumber) {
          hasAssignedLine = true
          const twilio = setupData.assignedTwilioNumber
          setWizardData((prev) => ({
            ...prev,
            phoneNumber: twilio,
            book8Number: prev.book8Number || primary.book8Number || twilio,
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

        if (hasAssignedLine) {
          step = 7
        }

        const urlStep = searchParams.get('step')
        if (urlStep) {
          const s = parseInt(urlStep, 10)
          if (s >= 1 && s <= 7) step = s
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

  // Re-sync after OAuth return (same-tab navigation); checkout uses full redirect — loadInitialState already runs on mount
  useEffect(() => {
    const googleConnected = searchParams.get('google_connected')
    const outlookConnected = searchParams.get('outlook_connected')
    const bizId = searchParams.get('businessId')
    if ((googleConnected || outlookConnected) && bizId && wizardData.businessId === bizId) {
      loadInitialState()
    }
  }, [searchParams, wizardData.businessId, loadInitialState])

  // Step 6: poll for assigned Twilio line after user submits phone preferences
  useEffect(() => {
    if (currentStep !== 6) return
    if (!token || !wizardData.businessId) return
    const tier = normalizePlanKey(wizardData.subscriptionPlan)
    if (tier === 'starter') return
    if (phoneStepPhase !== 'provisioning') return

    if (wizardData.phoneNumber) {
      setPhoneStepPhase(wizardData.phoneSetup === 'forward' ? 'forward-ready' : 'new-ready')
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

    const persistBook8 = async (num, setup, existing) => {
      try {
        await fetch('/api/business/phone-setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            businessId: wizardData.businessId,
            phoneSetup: setup,
            book8Number: num,
            ...(setup === 'forward' && existing ? { existingBusinessNumber: existing } : {})
          })
        })
      } catch {
        /* ignore */
      }
    }

    const fetchPhoneLine = async () => {
      try {
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
          setPhoneStepPhase('error')
          clearPoll()
          return
        }

        const num = data.assignedTwilioNumber ?? data.phoneNumber ?? null
        if (num) {
          const setup = wizardData.phoneSetup || phoneStepChoice
          const existing =
            setup === 'forward'
              ? wizardData.existingBusinessNumber ||
                normalizeBusinessPhoneInput(phoneStepExistingInput)
              : null
          setWizardData((prev) => ({
            ...prev,
            phoneNumber: num,
            book8Number: num,
            phoneSetup: setup === 'forward' ? 'forward' : setup === 'new' ? 'new' : prev.phoneSetup
          }))
          void persistBook8(num, setup === 'forward' ? 'forward' : 'new', existing)
          setPhoneStepPhase(setup === 'forward' ? 'forward-ready' : 'new-ready')
          clearPoll()
          return
        }
      } catch {
        firstPhoneFetch = false
        if (!cancelled) {
          setPhoneStepPhase('error')
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
  }, [
    currentStep,
    token,
    wizardData.businessId,
    wizardData.phoneNumber,
    wizardData.subscriptionPlan,
    wizardData.phoneSetup,
    wizardData.existingBusinessNumber,
    phoneStepPhase,
    phoneStepChoice,
    phoneStepExistingInput,
    phoneStepPollKey
  ])

  // Step 7 (You're Live): poll phone-setup if line not yet assigned
  useEffect(() => {
    if (currentStep !== 7) {
      setStep7LineState('idle')
      return
    }
    if (!token || !wizardData.businessId) return

    const tier = normalizePlanKey(wizardData.subscriptionPlan)
    if (tier === 'starter') {
      setStep7LineState('live')
      return
    }

    if (wizardData.phoneNumber) {
      setStep7LineState('live')
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
        setStep7LineState((prev) => {
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
          setStep7LineState('error')
          clearPoll()
          return
        }

        const num = data.assignedTwilioNumber ?? data.phoneNumber ?? null
        if (num) {
          setWizardData((prev) => ({ ...prev, phoneNumber: num, book8Number: num }))
          setStep7LineState('live')
          clearPoll()
          const ps = wizardData.phoneSetup || 'new'
          void fetch('/api/business/phone-setup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              businessId: wizardData.businessId,
              phoneSetup: ps,
              book8Number: num,
              ...(ps === 'forward' && wizardData.existingBusinessNumber
                ? { existingBusinessNumber: wizardData.existingBusinessNumber }
                : {})
            })
          }).catch(() => {})
          return
        }

        setStep7LineState('provisioning')
      } catch {
        firstPhoneFetch = false
        if (!cancelled) {
          setStep7LineState('error')
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
  }, [
    currentStep,
    token,
    wizardData.businessId,
    wizardData.phoneNumber,
    wizardData.subscriptionPlan,
    wizardData.phoneSetup,
    wizardData.existingBusinessNumber,
    step7RetryKey
  ])

  // Step 7: load handle from our DB only (no core-api)
  useEffect(() => {
    if (currentStep !== 7 || !token || !wizardData.businessId) return
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

  /** Force dark surfaces + light copy so theme tokens (e.g. light Card) never wash out labels. */
  const WIZARD_CARD = '!bg-[#12121A] !text-slate-200 !border-[#1e1e2e]'
  const WIZARD_LABEL = '!text-slate-100'
  const WIZARD_INPUT =
    '!mt-1 !bg-[#0A0A0F] !text-white !border-[#1e1e2e] placeholder:!text-slate-500'
  const WIZARD_INPUT_INLINE =
    '!bg-[#0A0A0F] !text-white !border-[#1e1e2e] placeholder:!text-slate-500'
  const WIZARD_SELECT_TRIGGER = '!bg-[#0A0A0F] !border-[#1e1e2e] !text-white'
  const WIZARD_SELECT_CONTENT = '!bg-[#12121A] !border-[#1e1e2e]'
  const WIZARD_SELECT_ITEM = '!text-white focus:!bg-[#1e1e2e]'
  const WIZARD_OUTLINE_BTN =
    '!border-[#2a2a3d] !bg-[#0A0A0F] !text-white hover:!bg-[#1e1e2e]'
  const WIZARD_OUTLINE_MUTED =
    '!border-[#1e1e2e] !text-[#94A3B8] hover:!text-white hover:!bg-[#1e1e2e] !bg-transparent'

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
    if (wizardData.category === 'other' && !wizardData.customCategory?.trim()) {
      setError('Please describe what type of business you run')
      return
    }
    if (wizardData.category === 'other' && wizardData.customCategory.trim().length < 2) {
      setError('Business type must be at least 2 characters')
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
          customCategory:
            wizardData.category === 'other' ? wizardData.customCategory.trim() : undefined,
          city: wizardData.city?.trim() || undefined,
          timezone: wizardData.timezone,
          primaryLanguage: wizardData.primaryLanguage,
          multilingualEnabled: wizardData.multilingualEnabled
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
        businessId: wizardData.businessId,
        returnTo: 'setup'
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

  useEffect(() => {
    if (currentStep !== 5) {
      setStep5Ready(false)
      setStep5CoreServiceIds([])
      setStep5Rows([{ rowKey: generateServiceDraftRowKey(), name: '', durationMinutes: 30 }])
    }
  }, [currentStep])

  // Step 5: load existing core service IDs (defaults to delete on save); UI starts with one empty row
  useEffect(() => {
    if (currentStep !== 5 || !token) return
    let cancelled = false
    setStep5Ready(false)
    ;(async () => {
      const ids = []
      try {
        let list = []
        if (wizardData.handle) {
          const r = await fetch(`/api/public/services?handle=${encodeURIComponent(wizardData.handle)}`, {
            cache: 'no-store'
          })
          const data = await r.json()
          if (data.ok && Array.isArray(data.services)) list = data.services
        }
        if (!list.length && wizardData.businessId) {
          const r = await fetch(`/api/business/${wizardData.businessId}/services`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          })
          const data = await r.json()
          list = data.services ?? (Array.isArray(data) ? data : [])
        }
        if (Array.isArray(list)) {
          for (const s of list) {
            const id = s.serviceId || s.id
            if (id) ids.push(String(id))
          }
        }
      } catch (err) {
        console.error('[setup] Step 5 load service ids:', err)
      }
      if (!cancelled) {
        setStep5CoreServiceIds(ids)
        setStep5Rows([{ rowKey: generateServiceDraftRowKey(), name: '', durationMinutes: 30 }])
        setStep5Ready(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentStep, wizardData.handle, wizardData.businessId, token])

  function updateStep5Row(rowKey, patch) {
    setError('')
    setStep5Rows((rows) => rows.map((r) => (r.rowKey === rowKey ? { ...r, ...patch } : r)))
  }

  function addStep5Row() {
    setError('')
    setStep5Rows((rows) => [
      ...rows,
      { rowKey: generateServiceDraftRowKey(), name: '', durationMinutes: 30 }
    ])
  }

  function removeStep5Row(rowKey) {
    setError('')
    setStep5Rows((rows) => {
      if (rows.length <= 1) return rows
      return rows.filter((r) => r.rowKey !== rowKey)
    })
  }

  async function handleStep5Submit() {
    if (!wizardData.businessId) return
    const trimmedRows = step5Rows
      .map((r) => ({
        rowKey: r.rowKey,
        name: (r.name || '').trim(),
        durationMinutes: Number(r.durationMinutes) || 30
      }))
      .filter((r) => r.name.length > 0)
    if (trimmedRows.length === 0) {
      setError('Add at least one service with a name')
      return
    }
    const seen = new Set()
    for (const r of trimmedRows) {
      const k = r.name.toLowerCase()
      if (seen.has(k)) {
        setError(`Duplicate service name: "${r.name}"`)
        return
      }
      seen.add(k)
    }
    setSaving(true)
    setError('')
    try {
      for (const serviceId of step5CoreServiceIds) {
        try {
          const dr = await fetch(
            `/api/business/${encodeURIComponent(wizardData.businessId)}/services/${encodeURIComponent(serviceId)}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
          )
          if (!dr.ok && dr.status !== 404) {
            const errBody = await dr.json().catch(() => ({}))
            console.warn('[setup] DELETE service', serviceId, errBody)
          }
        } catch (e) {
          console.warn('[setup] DELETE service failed', serviceId, e)
        }
      }
      for (const r of trimmedRows) {
        const serviceId = generateServiceIdForCore(r.name, r.durationMinutes)
        const pr = await fetch(`/api/business/${wizardData.businessId}/services`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            serviceId,
            name: r.name,
            durationMinutes: r.durationMinutes,
            active: true
          })
        })
        const pdata = await pr.json().catch(() => ({}))
        if (!pr.ok) {
          throw new Error(pdata.error || `Could not save service: ${r.name}`)
        }
      }
      const catalogPayload = {
        businessId: wizardData.businessId,
        category: wizardData.category,
        customCategory: wizardData.category === 'other' ? wizardData.customCategory?.trim() || null : null,
        services: trimmedRows.map((r) => ({ name: r.name, durationMinutes: r.durationMinutes }))
      }
      await fetch(`/api/business/${encodeURIComponent(wizardData.businessId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ onboardingServicesCatalog: catalogPayload })
      }).catch(() => {})

      const tier = normalizePlanKey(wizardData.subscriptionPlan)
      if (tier === 'starter') {
        setCurrentStep(7)
        setStep7LineState('live')
      } else {
        setPhoneStepPollKey((k) => k + 1)
        setCurrentStep(6)
      }
    } catch (err) {
      setError(err.message || 'Failed to save services')
    } finally {
      setSaving(false)
    }
  }

  async function handlePhoneStepSubmitPrefs() {
    if (!wizardData.businessId || !token) return
    const tier = normalizePlanKey(wizardData.subscriptionPlan)
    if (tier === 'starter') {
      setCurrentStep(7)
      return
    }
    if (phoneStepPhase === 'new-ready' || phoneStepPhase === 'forward-ready') {
      setCurrentStep(7)
      return
    }
    if (phoneStepChoice === 'forward') {
      if (!isInternationalBusinessPhoneValid(phoneStepExistingInput)) {
        setError(
          'Enter a valid phone number with country code (e.g. +1 for US/Canada, +44 for UK).'
        )
        return
      }
    }

    setPhoneStepSaving(true)
    setError('')
    try {
      const phoneSetup = phoneStepChoice === 'forward' ? 'forward' : 'new'
      const r = await fetch('/api/business/phone-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: wizardData.businessId,
          phoneSetup,
          ...(phoneSetup === 'forward'
            ? {
                existingBusinessNumber: normalizeBusinessPhoneInput(phoneStepExistingInput)
              }
            : {})
        })
      })
      const out = await r.json().catch(() => ({}))
      if (!r.ok || !out.ok) {
        throw new Error(out.error || 'Could not save phone preferences')
      }
      const normExistingForward =
        phoneSetup === 'forward' ? normalizeBusinessPhoneInput(phoneStepExistingInput) : null
      updateWizard({
        phoneSetup,
        existingBusinessNumber: normExistingForward
      })
      setPhoneStepPhase('provisioning')
      setPhoneStepPollKey((k) => k + 1)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setPhoneStepSaving(false)
    }
  }

  function handlePhoneStepSkipForwarding() {
    setCurrentStep(7)
  }

  // Step 6: never auto-skip to assigned-number UI — always start at pick with cards.
  // Pre-select new vs forward from saved business prefs only (not from assignedTwilioNumber).
  useEffect(() => {
    if (currentStep !== 6) {
      setPhoneStepPhase('pick')
      phoneStepPrevRef.current = currentStep
      return
    }

    const tier = normalizePlanKey(wizardData.subscriptionPlan)
    if (tier === 'starter') {
      setCurrentStep(7)
      phoneStepPrevRef.current = currentStep
      return
    }

    const enteredFromElsewhere = phoneStepPrevRef.current !== 6
    phoneStepPrevRef.current = currentStep

    if (!enteredFromElsewhere) return

    setPhoneStepPhase('pick')
    if (wizardData.phoneSetup === 'forward') {
      setPhoneStepChoice('forward')
      if (wizardData.existingBusinessNumber) {
        setPhoneStepExistingInput(String(wizardData.existingBusinessNumber))
      } else {
        setPhoneStepExistingInput('')
      }
    } else {
      setPhoneStepChoice('new')
      setPhoneStepExistingInput('')
    }
  }, [
    currentStep,
    wizardData.subscriptionPlan,
    wizardData.phoneSetup,
    wizardData.existingBusinessNumber
  ])

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
    return (
      <SetupAuthScreen
        initialLoginMode={isLoginMode}
        onAuthenticated={() => {
          const t = localStorage.getItem('book8_token')
          setToken(t)
        }}
      />
    )
  }

  const setupPlanTier =
    wizardData.subscriptionPlan != null && String(wizardData.subscriptionPlan).trim() !== ''
      ? normalizePlanKey(wizardData.subscriptionPlan)
      : null
  const isStarterSetupProgress = setupPlanTier === 'starter'
  const skippedStepNumbers = isStarterSetupProgress ? new Set([6]) : new Set()
  const totalProgressSteps = isStarterSetupProgress ? 6 : 7
  const progressNumerator =
    !isStarterSetupProgress ? currentStep : currentStep <= 5 ? currentStep : 6
  const progressPct = (progressNumerator / totalProgressSteps) * 100

  return (
    <main className="min-h-screen bg-[#0A0A0F]">
      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1
              const isSkipped = skippedStepNumbers.has(stepNum)
              const isCurrent = currentStep === stepNum
              const isCompleted = !isSkipped && stepNum < currentStep
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center min-w-0 ${
                    isSkipped
                      ? 'text-[#64748B]'
                      : isCurrent || isCompleted
                        ? 'text-[#8B5CF6]'
                        : 'text-[#64748B]'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isSkipped
                        ? 'bg-[#1e1e2e] text-[#64748B] ring-1 ring-dashed ring-[#475569]'
                        : isCompleted
                          ? 'bg-[#8B5CF6] text-white'
                          : isCurrent
                            ? 'bg-[#8B5CF6] text-white ring-2 ring-[#8B5CF6]/50 ring-offset-2 ring-offset-[#0A0A0F]'
                            : 'bg-[#1e1e2e] text-[#64748B]'
                    }`}
                  >
                    {isSkipped ? (
                      <Minus className="w-4 h-4" />
                    ) : isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span className="text-[10px] mt-1 hidden sm:block truncate max-w-full">{label}</span>
                </div>
              )
            })}
          </div>
          <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          'mx-auto px-4 py-8 sm:py-12 w-full transition-all duration-300 ease-in-out',
          currentStep === 2 ? 'max-w-6xl' : 'max-w-xl'
        )}
      >
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {searchParams.get('newBusiness') === '1' && currentStep === 1 && (
          <div className="mb-6 rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-3 text-sm text-[#E9D5FF]">
            You&apos;re registering a <span className="font-semibold text-white">new business</span>. Existing
            businesses remain in your dashboard.
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
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className={WIZARD_LABEL}>Business name *</Label>
                  <Input
                    className={WIZARD_INPUT}
                    placeholder="e.g. Downtown Barber, Bloom Wellness"
                    value={wizardData.businessName}
                    onChange={(e) => updateWizard({ businessName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className={WIZARD_LABEL}>Category *</Label>
                  <Select
                    value={wizardData.category}
                    onValueChange={(v) =>
                      updateWizard({
                        category: v,
                        ...(v !== 'other' ? { customCategory: '' } : {})
                      })
                    }
                  >
                    <SelectTrigger className={WIZARD_SELECT_TRIGGER}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={WIZARD_SELECT_CONTENT}>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} className={WIZARD_SELECT_ITEM}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {wizardData.category === 'other' && (
                  <div>
                    <Label className={WIZARD_LABEL}>What type of business do you run? *</Label>
                    <Input
                      className={WIZARD_INPUT}
                      placeholder="e.g. Tattoo Shop, Dog Grooming, Acupuncture"
                      value={wizardData.customCategory}
                      onChange={(e) => updateWizard({ customCategory: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <Label className={WIZARD_LABEL}>City (optional)</Label>
                  <Input
                    className={WIZARD_INPUT}
                    placeholder="e.g. London, Tokyo, São Paulo"
                    value={wizardData.city}
                    onChange={(e) => updateWizard({ city: e.target.value })}
                  />
                </div>
                <div>
                  <TimeZonePicker
                    value={wizardData.timezone}
                    onChange={(tz) => updateWizard({ timezone: tz })}
                    labelClassName={WIZARD_LABEL}
                    hintClassName="!text-[#94A3B8]"
                    selectClassName="!bg-[#0A0A0F] !border-[#1e1e2e] !text-white"
                    inputClassName="!bg-[#0A0A0F] !border-[#1e1e2e] !text-white placeholder:!text-slate-500"
                    idPrefix="setup-wizard"
                  />
                </div>
                <div>
                  <Label className={WIZARD_LABEL}>Primary language</Label>
                  <Select
                    value={wizardData.primaryLanguage}
                    onValueChange={(v) => updateWizard({ primaryLanguage: v })}
                  >
                    <SelectTrigger className={cn('mt-1', WIZARD_SELECT_TRIGGER)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={WIZARD_SELECT_CONTENT}>
                      {PRIMARY_LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code} className={WIZARD_SELECT_ITEM}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs !text-[#94A3B8] mt-2">
                    Your AI receptionist greets callers in this language by default. It automatically switches
                    to your customer&apos;s language during the call when multilingual is on.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-[#1e1e2e] bg-[#0A0A0F]/60 p-4">
                  <Switch
                    id="setup-multilingual"
                    checked={wizardData.multilingualEnabled}
                    onCheckedChange={(on) => updateWizard({ multilingualEnabled: on })}
                    className="data-[state=checked]:bg-[#8B5CF6] mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="setup-multilingual" className={cn(WIZARD_LABEL, '!text-white cursor-pointer')}>
                      Enable multilingual (recommended)
                    </Label>
                    <p className="text-xs !text-[#94A3B8]">
                      Automatically detect and respond fluently in 70+ languages — no extra setup.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white mt-4"
                  onClick={handleStep1Submit}
                  disabled={
                    saving ||
                    !wizardData.businessName?.trim() ||
                    (wizardData.category === 'other' && !wizardData.customCategory?.trim())
                  }
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
              <Card className={WIZARD_CARD}>
                <CardContent className="pt-6">
                  <p className="!text-[#94A3B8] mb-4">You already have an active plan. Continue to the next step.</p>
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
              <Card className={cn(WIZARD_CARD, 'max-w-xl mx-auto !border-[#8B5CF6]/40')}>
                <CardContent className="pt-6 space-y-4">
                  <p className="!text-white font-semibold">You&apos;re starting a 14-day free trial of the Growth plan.</p>
                  <ul className="text-sm !text-[#94A3B8] space-y-2 list-disc pl-5">
                    <li>Full access to all features immediately</li>
                    <li>
                      Your card is required but won&apos;t be charged until{' '}
                      <span className="!text-[#F8FAFC] font-medium">{trialChargeDateLabel}</span>
                    </li>
                    <li>Cancel anytime before then and pay nothing</li>
                  </ul>
                  <p className="text-xs !text-[#64748B] flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                    Card required for verification. No charge for 14 days.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className={WIZARD_OUTLINE_MUTED}
                      onClick={() => setStep2CheckoutPhase('choose')}
                      disabled={saving}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 lg:items-stretch w-full max-w-full">
                {/* Starter */}
                <Card
                  className={cn(
                    WIZARD_CARD,
                    'order-1 lg:order-1 min-w-0 lg:min-w-[280px] w-full max-w-full h-full flex flex-col overflow-hidden'
                  )}
                >
                  <CardContent className="p-0 flex flex-col h-full min-h-0 flex-1 justify-between">
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="px-5 pt-5 pb-4 !bg-[#18182b] border-b !border-[#1e1e2e]">
                        <div className="flex items-center gap-2">
                          <Zap className="w-5 h-5 text-[#06B6D4] shrink-0" aria-hidden />
                          <h3 className="text-base font-semibold !text-white">Starter</h3>
                        </div>
                        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span className="text-3xl font-bold tabular-nums !text-white">$29</span>
                          <span className="text-sm !text-[#94A3B8]">USD / monthly</span>
                        </div>
                        <p className="mt-2 text-sm leading-snug !text-[#94A3B8]">
                          One location: calendar sync, booking page, reminders.
                        </p>
                      </div>
                      <div className="px-5 py-4 flex-1 flex flex-col !bg-[#0A0A0F] lg:min-h-[10.5rem]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider !text-[#64748B] mb-3">
                          Includes:
                        </p>
                        <ul className="space-y-2 text-sm leading-snug !text-[#94A3B8]">
                          {[
                            'Calendar sync and booking page',
                            'Email reminders',
                            'Core analytics',
                            'Metered call minutes'
                          ].map((line) => (
                            <li key={line} className="flex gap-2.5">
                              <Check className="w-4 h-4 shrink-0 text-[#8B5CF6] mt-0.5" aria-hidden />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-4 shrink-0 !bg-[#0A0A0F] border-t !border-[#1e1e2e]/80">
                      <Button
                        variant="outline"
                        className={cn('w-full', WIZARD_OUTLINE_BTN)}
                        onClick={() => handleStep2Submit(planPriceIds.starter)}
                        disabled={saving || !planPriceIds.starter}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Growth — lg: glow + scale; mobile: purple border only */}
                <Card
                  className={cn(
                    WIZARD_CARD,
                    'border-2 !border-[#8B5CF6]/70 order-2 lg:order-2 min-w-0 lg:min-w-[280px] w-full max-w-full h-full flex flex-col overflow-hidden lg:shadow-[0_0_48px_-12px_rgba(139,92,246,0.55)] lg:scale-[1.07] lg:z-10 relative'
                  )}
                >
                  <CardContent className="p-0 flex flex-col h-full min-h-0 flex-1 justify-between">
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="px-5 pt-5 pb-4 !bg-[#1e1a2e] border-b !border-[#8B5CF6]/25">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-[#8B5CF6] shrink-0" aria-hidden />
                          <h3 className="text-base font-semibold !text-white">Growth</h3>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide !text-[#A78BFA]">
                          Best value · 14-day trial
                        </p>
                        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span className="text-3xl font-bold tabular-nums !text-white">$99</span>
                          <span className="text-sm !text-[#94A3B8]">USD / monthly</span>
                        </div>
                        <p className="mt-2 text-sm leading-snug !text-[#94A3B8]">
                          After trial: AI voice, SMS, multi-calendar, up to 5 businesses.
                        </p>
                        <p className="mt-2 text-xs !text-[#A78BFA] leading-snug">
                          Card on file; no charge until trial ends.
                        </p>
                      </div>
                      <div className="px-5 py-4 flex-1 flex flex-col !bg-[#0A0A0F] lg:min-h-[10.5rem] border-t !border-[#8B5CF6]/10">
                        <p className="text-[10px] font-semibold uppercase tracking-wider !text-[#64748B] mb-3">
                          Includes:
                        </p>
                        <ul className="space-y-2 text-sm leading-snug !text-[#94A3B8]">
                          {[
                            'Everything in Starter',
                            'AI voice booking 24/7',
                            'Multi-calendar and SMS',
                            'Up to 5 businesses'
                          ].map((line) => (
                            <li key={line} className="flex gap-2.5">
                              <Check className="w-4 h-4 shrink-0 text-[#8B5CF6] mt-0.5" aria-hidden />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-4 shrink-0 !bg-[#0A0A0F] border-t !border-[#8B5CF6]/10">
                      <Button
                        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
                        onClick={() => setStep2CheckoutPhase('confirm')}
                        disabled={saving || !planPriceIds.growth}
                      >
                        Start Free Trial
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                      <p className="text-[10px] !text-[#64748B] text-center leading-snug mt-2">
                        No charge for 14 days. Cancel anytime. Card required.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Enterprise */}
                <Card
                  className={cn(
                    WIZARD_CARD,
                    'order-3 lg:order-3 min-w-0 lg:min-w-[280px] w-full max-w-full h-full flex flex-col overflow-hidden'
                  )}
                >
                  <CardContent className="p-0 flex flex-col h-full min-h-0 flex-1 justify-between">
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="px-5 pt-5 pb-4 !bg-[#18182b] border-b !border-[#1e1e2e]">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-amber-500/90 shrink-0" aria-hidden />
                          <h3 className="text-base font-semibold !text-white">Enterprise</h3>
                        </div>
                        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                          <span className="text-3xl font-bold tabular-nums !text-white">$299</span>
                          <span className="text-sm !text-[#94A3B8]">USD / monthly</span>
                        </div>
                        <p className="mt-2 text-sm leading-snug !text-[#94A3B8]">
                          Seats, priority support, SLA options.
                        </p>
                      </div>
                      <div className="px-5 py-4 flex-1 flex flex-col !bg-[#0A0A0F] lg:min-h-[10.5rem]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider !text-[#64748B] mb-3">
                          Includes:
                        </p>
                        <ul className="space-y-2 text-sm leading-snug !text-[#94A3B8]">
                          {[
                            'Everything in Growth',
                            'Advanced seats and org tools',
                            'Priority support',
                            'SLA and custom options'
                          ].map((line) => (
                            <li key={line} className="flex gap-2.5">
                              <Check className="w-4 h-4 shrink-0 text-[#8B5CF6] mt-0.5" aria-hidden />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-4 shrink-0 !bg-[#0A0A0F] border-t !border-[#1e1e2e]/80">
                      <Button
                        variant="outline"
                        className={cn('w-full', WIZARD_OUTLINE_BTN)}
                        onClick={() => handleStep2Submit(planPriceIds.enterprise)}
                        disabled={saving || !planPriceIds.enterprise}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Get Started
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
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
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className={cn('h-14', WIZARD_OUTLINE_BTN)}
                    onClick={handleConnectGoogle}
                  >
                    <Calendar className="w-5 h-5 mr-2" />
                    Google Calendar
                  </Button>
                  {hasOutlookCalendar(wizardData.subscriptionPlan) ? (
                    <Button
                      variant="outline"
                      className={cn('h-14', WIZARD_OUTLINE_BTN)}
                      onClick={handleConnectOutlook}
                    >
                      <Calendar className="w-5 h-5 mr-2" />
                      Outlook
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push('/pricing')}
                      className={cn(
                        'h-14 w-full rounded-md border border-[#1e1e2e] bg-[#0A0A0F]/80 flex flex-col items-center justify-center px-2 text-center opacity-60 hover:opacity-80 transition-opacity cursor-pointer'
                      )}
                    >
                      <span className="text-xs font-medium text-[#94A3B8] flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        Outlook
                      </span>
                      <span className="text-[10px] text-[#64748B] mt-0.5">
                        Growth — upgrade
                        <span className="text-purple-400 ml-1">View plans →</span>
                      </span>
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  className="w-full !text-[#94A3B8] hover:!text-white"
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
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-4">
                <Button
                  variant="outline"
                  size="sm"
                  className={WIZARD_OUTLINE_MUTED}
                  onClick={applyWeekdaysSame}
                >
                  Apply same hours to all weekdays
                </Button>
                <div className="space-y-3">
                  {DAYS.map((day) => (
                    <div
                      key={day}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
                    >
                      <div className="flex items-center gap-3 min-h-[36px]">
                        <div className="w-12 text-sm font-medium !text-[#94A3B8] shrink-0">
                          {DAY_LABELS[day]}
                        </div>
                        <Switch
                          checked={isDayOpen(day)}
                          onCheckedChange={(open) => setDayOpen(day, open)}
                          className="data-[state=checked]:bg-[#8B5CF6]"
                        />
                        {!isDayOpen(day) && (
                          <span className="!text-[#64748B] text-sm sm:ml-0">Closed</span>
                        )}
                      </div>
                      {isDayOpen(day) && (
                        <div className="flex items-center gap-2 flex-wrap ml-0 sm:ml-0">
                          <select
                            className="h-9 rounded-md appearance-none !border-[#1e1e2e] !bg-[#0A0A0F] !text-white border text-sm px-3 py-2 min-w-0"
                            value={wizardData.businessHours[day]?.[0]?.start || '09:00'}
                            onChange={(e) => setDayBlock(day, 0, 'start', e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <span className="!text-[#64748B]">—</span>
                          <select
                            className="h-9 rounded-md appearance-none !border-[#1e1e2e] !bg-[#0A0A0F] !text-white border text-sm px-3 py-2 min-w-0"
                            value={wizardData.businessHours[day]?.[0]?.end || '17:00'}
                            onChange={(e) => setDayBlock(day, 0, 'end', e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className={WIZARD_OUTLINE_MUTED}
                    onClick={() => setCurrentStep(3)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white flex-1"
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
              <h1 className="text-2xl font-bold text-white">Add your services</h1>
              <p className="text-[#94A3B8] mt-1">
                What do your customers book? Add at least one service.
              </p>
              <p className="text-sm !text-[#64748B] mt-3">
                Services for:{' '}
                <span className="!text-white font-medium">
                  {getServicesContextLabel(wizardData.category, wizardData.customCategory)}
                </span>
              </p>
            </div>
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-4">
                {!step5Ready ? (
                  <div className="flex items-center gap-2 text-sm !text-[#94A3B8]">
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#8B5CF6]" />
                    Preparing…
                  </div>
                ) : (
                  <>
                    <ul className="space-y-3">
                      {step5Rows.map((row) => (
                        <li
                          key={row.rowKey}
                          className="flex flex-wrap items-center gap-3 rounded-lg !border-[#1e1e2e] border px-4 py-3"
                        >
                          <Input
                            className={cn('flex-1 min-w-[12rem]', WIZARD_INPUT_INLINE)}
                            placeholder="e.g. Haircut, Deep Tissue Massage, Oil Change..."
                            value={row.name}
                            onChange={(e) => updateStep5Row(row.rowKey, { name: e.target.value })}
                            aria-label="Service name"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              className="h-9 rounded-md !border-[#1e1e2e] !bg-[#0A0A0F] !text-white text-sm px-2 border min-w-[5.5rem]"
                              value={String(row.durationMinutes)}
                              onChange={(e) =>
                                updateStep5Row(row.rowKey, {
                                  durationMinutes: Number(e.target.value)
                                })
                              }
                              aria-label="Duration"
                            >
                              {SERVICE_DURATION_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                  {m} min
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="!text-[#94A3B8] hover:!text-white hover:!bg-[#1e1e2e] shrink-0"
                              onClick={() => removeStep5Row(row.rowKey)}
                              disabled={step5Rows.length <= 1}
                              aria-label="Remove service"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn('w-full sm:w-auto', WIZARD_OUTLINE_MUTED)}
                      onClick={addStep5Row}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add another service
                    </Button>
                    {step5ContinueState.hint ? (
                      <p className="text-sm text-amber-200/90">{step5ContinueState.hint}</p>
                    ) : null}
                  </>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className={WIZARD_OUTLINE_MUTED}
                    onClick={() => setCurrentStep(4)}
                    disabled={saving}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white flex-1"
                    onClick={handleStep5Submit}
                    disabled={saving || !step5ContinueState.canContinue}
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

        {/* Step 6: Phone line */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Set up your phone line</h1>
              <p className="text-[#94A3B8] mt-1">
                How would you like customers to reach your AI receptionist?
              </p>
            </div>
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-6">
                {phoneStepPhase === 'pick' && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setPhoneStepChoice('new')}
                      className={cn(
                        'w-full text-left rounded-xl border p-4 transition-colors',
                        phoneStepChoice === 'new'
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/40'
                          : 'border-[#1e1e2e] bg-[#0A0A0F]/60 hover:border-[#2a2a3d]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl" aria-hidden>
                          📱
                        </span>
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold !text-white">Get a new Book8 AI number</p>
                          <p className="text-sm !text-[#94A3B8]">
                            We&apos;ll assign a dedicated phone number just for your business.
                          </p>
                          <p className="text-xs !text-[#A78BFA] mt-1">Recommended for new businesses</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhoneStepChoice('forward')}
                      className={cn(
                        'w-full text-left rounded-xl border p-4 transition-colors',
                        phoneStepChoice === 'forward'
                          ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/40'
                          : 'border-[#1e1e2e] bg-[#0A0A0F]/60 hover:border-[#2a2a3d]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl" aria-hidden>
                          📞
                        </span>
                        <div className="space-y-3 min-w-0 flex-1">
                          <div>
                            <p className="font-semibold !text-white">Use my existing business number</p>
                            <p className="text-sm !text-[#94A3B8] mt-1">
                              Keep your current number. We&apos;ll show you how to forward calls to your AI
                              receptionist.
                            </p>
                          </div>
                          {phoneStepChoice === 'forward' && (
                            <div>
                              <Label className={WIZARD_LABEL}>Your business number</Label>
                              <Input
                                className={cn('mt-1 max-w-md', WIZARD_INPUT_INLINE)}
                                placeholder="e.g. +1 555 123 4567"
                                value={phoneStepExistingInput}
                                onChange={(e) => setPhoneStepExistingInput(e.target.value)}
                                autoComplete="tel"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {phoneStepPhase === 'provisioning' && !wizardData.phoneNumber && (
                  <div className="rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-4 flex items-start gap-3">
                    <Loader2 className="w-5 h-5 text-[#8B5CF6] shrink-0 animate-spin mt-0.5" />
                    <div>
                      <p className="text-sm font-medium !text-white">Getting your Book8 AI number…</p>
                      <p className="text-xs !text-[#94A3B8] mt-1">
                        This usually takes a short time. We check every 15 seconds until your line is ready.
                      </p>
                    </div>
                  </div>
                )}

                {phoneStepPhase === 'error' && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 space-y-2">
                    <p className="text-sm text-red-200">
                      We couldn&apos;t confirm your line yet. You can retry, or continue and finish from the dashboard.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-500/40 text-red-200 hover:bg-red-500/20"
                      onClick={() => {
                        setPhoneStepPhase('provisioning')
                        setPhoneStepPollKey((k) => k + 1)
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                )}

                {phoneStepPhase === 'new-ready' && wizardData.phoneNumber && (
                  <div className="rounded-lg border border-[#1e1e2e] bg-[#0A0A0F]/60 p-4 space-y-2">
                    <p className="text-sm font-medium !text-white">Your Book8 AI number</p>
                    <p className="text-xl font-mono !text-[#8B5CF6]">
                      {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber}
                    </p>
                    <p className="text-sm !text-[#94A3B8]">
                      Share this number with customers — calls and texts reach your AI receptionist.
                    </p>
                  </div>
                )}

                {phoneStepPhase === 'forward-ready' && wizardData.phoneNumber && (
                  <div className="space-y-4 rounded-lg border border-[#1e1e2e] bg-[#0A0A0F]/60 p-4">
                    <div>
                      <p className="text-lg font-semibold !text-white">Forward your calls to Book8 AI</p>
                      <p className="text-sm !text-[#94A3B8] mt-2">
                        When customers call your current number, calls can ring through to your AI receptionist once
                        forwarding is set up.
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide !text-[#64748B]">
                        Your AI receptionist number
                      </p>
                      <p className="text-xl font-mono !text-[#8B5CF6] mt-1">
                        {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber}
                      </p>
                    </div>
                    <div className="text-sm !text-[#94A3B8] space-y-3">
                      <div className="space-y-2">
                        <p className="font-medium !text-white">How to forward your calls:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm !text-[#94A3B8]">
                          <li>
                            Contact your phone provider and request call forwarding to{' '}
                            <span className="font-mono !text-white">
                              {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber}
                            </span>
                          </li>
                          <li>Ask them to forward all unanswered calls to this number</li>
                          <li>Test by calling your business line — the AI should answer</li>
                        </ol>
                        <p className="text-xs !text-[#64748B] mt-2">
                          Tip: In North America, you may be able to dial *72 followed by the number above. Forwarding
                          codes vary by carrier and country.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        type="button"
                        className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
                        onClick={() => setCurrentStep(7)}
                      >
                        I&apos;ve set up forwarding — Continue
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('flex-1', WIZARD_OUTLINE_MUTED)}
                        onClick={handlePhoneStepSkipForwarding}
                      >
                        I&apos;ll do this later — Skip for now
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    variant="outline"
                    className={WIZARD_OUTLINE_MUTED}
                    onClick={() => setCurrentStep(5)}
                    disabled={phoneStepSaving}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  {phoneStepPhase === 'pick' && (
                    <Button
                      className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
                      onClick={handlePhoneStepSubmitPrefs}
                      disabled={
                        phoneStepSaving ||
                        (phoneStepChoice === 'forward' &&
                          !isInternationalBusinessPhoneValid(phoneStepExistingInput))
                      }
                    >
                      {phoneStepSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                  {phoneStepPhase === 'new-ready' && (
                    <Button
                      className="flex-1 bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
                      onClick={() => setCurrentStep(7)}
                    >
                      Continue to You&apos;re Live
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 7: You're Live! */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#8B5CF6]/20 mb-4">
                <Sparkles className="w-8 h-8 text-[#8B5CF6]" />
              </div>
              <h1 className="text-2xl font-bold text-white">You&apos;re Live! 🎉</h1>
              <p className="text-[#94A3B8] mt-1">
                {normalizePlanKey(wizardData.subscriptionPlan) === 'starter'
                  ? 'Your online booking page is ready.'
                  : 'Your AI receptionist is ready.'}
              </p>
            </div>
            <Card className={WIZARD_CARD}>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-[#8B5CF6] mb-2">
                    <Phone className="w-5 h-5" />
                    <span className="font-semibold">Your Booking Line</span>
                  </div>
                  {normalizePlanKey(wizardData.subscriptionPlan) === 'starter' ? (
                    <div className="space-y-4">
                      <p className="text-sm !text-[#94A3B8]">
                        Want an AI phone agent too? Upgrade to Growth for a dedicated number that answers calls in 70+
                        languages.
                      </p>
                      <Button
                        type="button"
                        className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
                        onClick={() => router.push('/pricing')}
                      >
                        Upgrade to Growth →
                      </Button>
                    </div>
                  ) : wizardData.phoneSetup === 'forward' && wizardData.existingBusinessNumber ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#1e1e2e] bg-[#0A0A0F]/50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide !text-[#64748B]">
                          Your existing number
                        </p>
                        <p className="text-lg font-mono !text-white mt-1">
                          {formatPhone(wizardData.existingBusinessNumber) ||
                            wizardData.existingBusinessNumber}{' '}
                          <span className="text-sm font-sans !text-[#94A3B8]">(forwarded)</span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#1e1e2e] bg-[#0A0A0F]/50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide !text-[#64748B]">
                          Book8 AI number
                        </p>
                        <p className="text-lg font-mono !text-[#8B5CF6] mt-1">
                          {wizardData.phoneNumber
                            ? formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber
                            : '—'}
                        </p>
                      </div>
                      <p className="text-sm !text-[#94A3B8]">
                        Customers can keep calling the number they already know; forwarding sends those calls to your AI
                        line.
                      </p>
                      <p className="text-xs !text-[#64748B] border border-[#1e1e2e] rounded-lg px-3 py-2 bg-[#0A0A0F]/50">
                        If forwarding isn&apos;t active yet, contact your carrier to forward calls to{' '}
                        {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber || 'your Book8 line'}. In some
                        regions you can use carrier codes (e.g. *72 in parts of North America); codes vary by provider.
                      </p>
                    </div>
                  ) : wizardData.phoneNumber ? (
                    <>
                      <p className="text-xl font-mono !text-white">
                        {formatPhone(wizardData.phoneNumber) || wizardData.phoneNumber}
                      </p>
                      <p className="text-sm !text-[#94A3B8] mt-1">
                        Customers can call or text this number to book appointments.
                      </p>
                      <p className="text-xs !text-[#64748B] mt-3 border border-[#1e1e2e] rounded-lg px-3 py-2 bg-[#0A0A0F]/50">
                        Your AI receptionist speaks 70+ languages. Try calling in French or Spanish to hear it in
                        action.
                      </p>
                    </>
                  ) : step7LineState === 'error' ? (
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
                        onClick={() => setStep7RetryKey((k) => k + 1)}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-4 py-4 flex items-start gap-3">
                      <Loader2 className="w-5 h-5 text-[#8B5CF6] shrink-0 animate-spin mt-0.5" />
                      <div>
                        <p className="text-sm font-medium !text-white">Setting up your phone line…</p>
                        <p className="text-xs !text-[#94A3B8] mt-1">
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
                  <p className="text-lg font-mono !text-white break-all">
                    {bookingHost}/b/{wizardData.bookingHandle || wizardData.handle || 'your-business'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('mt-2', WIZARD_OUTLINE_MUTED)}
                    onClick={copyBookingLink}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
                <div className="rounded-lg !bg-[#0A0A0F] !border-[#1e1e2e] border p-4 text-sm !text-[#94A3B8]">
                  <p className="font-medium !text-white mb-2">Try it now!</p>
                  <ul className="space-y-1">
                    {normalizePlanKey(wizardData.subscriptionPlan) === 'starter' ? (
                      <li>→ Visit your booking page</li>
                    ) : wizardData.phoneSetup === 'forward' && wizardData.existingBusinessNumber ? (
                      <>
                        <li>→ Call your existing business number and confirm the AI answers (forwarding must be on)</li>
                        <li>
                          → Text your Book8 AI number: &quot;Book a cleaning tomorrow at 2pm&quot; — SMS uses your AI line
                        </li>
                        <li>→ Visit your booking page</li>
                      </>
                    ) : (
                      <>
                        <li>→ Call your number to hear the AI agent</li>
                        <li>→ Text your number: &quot;Book a cleaning tomorrow at 2pm&quot;</li>
                        <li>→ Visit your booking page</li>
                      </>
                    )}
                  </ul>
                </div>
                <Button
                  className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] !text-white"
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
