'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

const STEP1_KEY = 'book8.wizard.step1'
const STEP2_KEY = 'book8.wizard.step2'
const PROFILE_STORAGE_KEY = 'book8.wizard.profileFromCreate'

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(String(str || ''))))
}

function mapShortLangToWizardCode(short) {
  const s = String(short || '').trim().toLowerCase()
  if (s === 'en') return 'en-US'
  if (s === 'fr') return 'fr-FR'
  if (s === 'es') return 'es-419'
  if (s === 'ar') return 'ar'
  return 'en-US'
}

function buildMergedProfileFromSession() {
  const raw1 = sessionStorage.getItem(STEP1_KEY)
  const raw2 = sessionStorage.getItem(STEP2_KEY)
  if (!raw1 || !raw2) return null

  const step1 = JSON.parse(raw1)
  const step2 = JSON.parse(raw2)

  const step1Form = step1?.form || {}
  const step1Meta = step1?.meta || {}
  const step1Inference = step1?.inference || null

  const step1Payload = {
    businessName: String(step1Form.businessName || '').trim(),
    category: step1Form.category || 'other',
    description: String(step1Form.description || '').trim(),
    country: step1Form.countryLabel || 'United States',
    timezone: step1Form.timezone || 'America/New_York',
    language: step1Form.language || 'en',
    websiteUrl: String(step1Form.websiteUrl || '').trim(),
    address: String(step1Form.address || '').trim() || null,
    sampleServices: step1Meta.sampleServices || [],
    _confidence: step1Meta._confidence || {}
  }

  const step2VoiceLang = step2?.voiceLang || mapShortLangToWizardCode(step1Form.language)

  const cleanedServices = Array.isArray(step2?.services)
    ? step2.services
        .map((r) => ({
          name: String(r?.name || '').trim(),
          durationMinutes: Number(r?.durationMinutes) || 30,
          priceCents: Math.max(0, Math.round(Number(r?.priceCents) || 0))
        }))
        .filter((r) => r.name)
    : []

  const step2Payload = {
    v: 2,
    voiceLang: step2VoiceLang,
    hours: step2?.hours || {},
    services: cleanedServices
  }

  const combined = {
    step1: step1Payload,
    step2: step2Payload,
    _inference: step1Inference
  }

  return utf8ToBase64(JSON.stringify(combined))
}

export default function Step3Account({ onBack, onAuthSuccess }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState('signup') // 'signup' | 'login'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Protect wizard integrity: you shouldn't reach Step 3 without step1/step2.
    try {
      const raw1 = sessionStorage.getItem(STEP1_KEY)
      const raw2 = sessionStorage.getItem(STEP2_KEY)
      if (!raw1 || !raw2) {
        // Preserve description/vertical if present so Step 1 can re-render correctly.
        const params = new URLSearchParams(searchParams.toString())
        params.set('step', '1')
        params.delete('authJustCompleted')
        void router.replace(`/create?${params.toString()}`)
      }
    } catch {
      // If sessionStorage is blocked, do nothing; the user will likely error anyway.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const oauthCallbackUrl = useMemo(() => {
    const target = '/create?step=4&authJustCompleted=true'
    return `/auth/oauth-callback?redirect=${encodeURIComponent(target)}`
  }, [])

  const ensureProfileFromCreate = () => {
    try {
      const existing = sessionStorage.getItem(PROFILE_STORAGE_KEY)
      if (existing) return
      const merged = buildMergedProfileFromSession()
      if (merged) sessionStorage.setItem(PROFILE_STORAGE_KEY, merged)
    } catch {
      /* ignore */
    }
  }

  const setLocalAuth = (token, user) => {
    try {
      localStorage.setItem('book8_token', token)
      localStorage.setItem('book8_user', JSON.stringify(user || {}))
    } catch {
      /* ignore */
    }
  }

  const submit = async () => {
    setError('')
    const e = String(email || '').trim()
    const p = String(password || '')
    if (!e) {
      setError('Email is required.')
      return
    }
    if (!p) {
      setError('Password is required.')
      return
    }
    if (mode === 'signup' && p.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(mode === 'signup' ? '/api/credentials/register' : '/api/credentials/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:
          mode === 'signup'
            ? JSON.stringify({ email: e, password: p, name: '' })
            : JSON.stringify({ email: e, password: p })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        const msg = String(data?.error || 'Sign-in failed.')

        // Email already exists => switch to login mode and prefill email.
        if (mode === 'signup' && (res.status === 409 || msg.toLowerCase().includes('already'))) {
          setMode('login')
          setPassword('')
          setEmail(e)
          setError('Email already exists. Please sign in.')
          return
        }

        if (msg.toLowerCase().includes('weak')) {
          setError('Please use a stronger password.')
          return
        }

        setError(msg || 'Something went wrong.')
        return
      }

      setLocalAuth(data.token, data.user)
      ensureProfileFromCreate()
      onAuthSuccess?.()
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Save your progress</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          You're 2 minutes from your AI receptionist. Create a free account to keep your setup.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={() =>
              signIn('google', {
                callbackUrl: oauthCallbackUrl,
                redirect: true
              })
            }
            disabled={isLoading}
            variant="outline"
            className="h-12 flex-1 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-900 border-gray-200 font-medium"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
          <Button
            type="button"
            onClick={() =>
              signIn('azure-ad', {
                callbackUrl: oauthCallbackUrl,
                redirect: true
              })
            }
            disabled={isLoading}
            variant="outline"
            className="h-12 flex-1 px-4 rounded-xl bg-white hover:bg-gray-50 text-gray-900 border-gray-200 font-medium"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23" aria-hidden="true" focusable="false">
              <path fill="#f3f3f3" d="M0 0h23v23H0z" />
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            Continue with Microsoft
          </Button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <div className="text-xs text-[#94A3B8] whitespace-nowrap">Or continue with email</div>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wizard-auth-email" className="text-[#E2E8F0]">
              Email
            </Label>
            <Input
              id="wizard-auth-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
              placeholder="you@company.com"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wizard-auth-password" className="text-[#E2E8F0]">
              Password
            </Label>
            <Input
              id="wizard-auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'signup' ? (
              <p className="text-xs text-[#64748B]">
                Minimum 8 characters.
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          <Button
            type="button"
            onClick={submit}
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setError('')
              setMode((m) => (m === 'signup' ? 'login' : 'signup'))
              setPassword('')
            }}
            className="w-full text-center text-sm text-[#A78BFA] hover:text-[#E9D5FF] font-medium"
          >
            {mode === 'signup' ? (
              <>
                Already have an account? <span className="font-semibold">Sign in</span>
              </>
            ) : (
              <>
                Don&apos;t have an account? <span className="font-semibold">Create one</span>
              </>
            )}
          </button>
        </div>

        <p className="mt-5 text-xs text-[#64748B]">
          By continuing, you agree to our{' '}
          <a className="underline text-[#A78BFA] hover:text-[#E9D5FF]" href="/terms">
            Terms
          </a>{' '}
          and{' '}
          <a className="underline text-[#A78BFA] hover:text-[#E9D5FF]" href="/privacy">
            Privacy
          </a>
          .
        </p>

        <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
            onClick={() => onBack?.()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="text-xs text-[#64748B] sm:text-right">
            Step 3 of 7: Save your progress with a free account
          </div>
        </div>
      </section>
    </div>
  )
}

