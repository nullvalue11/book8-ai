'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { detectWizardCountry } from '@/lib/detectWizardCountry'
import { defaultChannelsForCountry } from '@/lib/businessChannels'
import { countryLabelToProfileCode } from '@/lib/wizardSetupPrefill'
import WizardSidebar from './_components/WizardSidebar'
import Step0Country, { WIZARD_STEP0_STORAGE_KEY } from './_components/Step0Country'
import Step1Profile from './_components/Step1Profile'
import Step2Agent from './_components/Step2Agent'
import Step3Account from './_components/Step3Account'
import Step4Skills from './_components/Step4Skills'
import Step5Test from './_components/Step5Test'
import Step5WhatsApp from './_components/Step5WhatsApp'

const STEP1_KEY = 'book8.wizard.step1'
const WIZARD_SESSION_ID_KEY = 'book8.wizard.sessionId'

function readOrCreateWizardSessionId() {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(WIZARD_SESSION_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? `wiz_${crypto.randomUUID()}`
          : `wiz_${Date.now()}`
      sessionStorage.setItem(WIZARD_SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return `wiz_${Date.now()}`
  }
}

function CreateWizardInner({ acceptLanguageHint = null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const descriptionParam = (searchParams.get('description') || '').trim()
  const verticalParam = (searchParams.get('vertical') || '').trim()

  const [currentStep, setCurrentStep] = useState(0)
  const [channels, setChannels] = useState(null)
  const [wizardSessionId, setWizardSessionId] = useState('')

  const [authToken, setAuthToken] = useState(() => {
    try {
      if (typeof window === 'undefined') return null
      return localStorage.getItem('book8_token')
    } catch {
      return null
    }
  })

  const stepParam = Number(searchParams.get('step') || '')
  const authJustCompleted = searchParams.get('authJustCompleted') === 'true'

  const isAuthenticated = !!authToken

  const voicePrimary = channels?.voice !== false

  /** 1-based step for sidebar (1…6) */
  const sidebarStep = currentStep + 1

  useEffect(() => {
    setWizardSessionId(readOrCreateWizardSessionId())
  }, [])

  useEffect(() => {
    try {
      const t = localStorage.getItem('book8_token')
      setAuthToken(t)
    } catch {
      /* ignore */
    }
  }, [])

  // Hydrate channels + optional migration (mid-flow users with step1 but no step0).
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    ;(async () => {
      try {
        const s0 = sessionStorage.getItem(WIZARD_STEP0_STORAGE_KEY)
        if (s0) {
          const j = JSON.parse(s0)
          if (j.v === 1 && j.profileCountry && j.channels) {
            if (!cancelled) setChannels(j.channels)
            return
          }
        }
        const raw1 = sessionStorage.getItem(STEP1_KEY)
        const code = raw1
          ? (() => {
              try {
                const rec = JSON.parse(raw1)
                const label = rec?.form?.countryLabel
                return countryLabelToProfileCode(label) || detectWizardCountry(searchParams)
              } catch {
                return detectWizardCountry(searchParams, { acceptLanguage: acceptLanguageHint })
              }
            })()
          : detectWizardCountry(searchParams, { acceptLanguage: acceptLanguageHint })
        const res = await fetch(`/api/business/channels?country=${encodeURIComponent(code)}`, {
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        const ch =
          res.ok && data.ok && data.channels ? data.channels : defaultChannelsForCountry(code)
        if (raw1) {
          try {
            sessionStorage.setItem(
              WIZARD_STEP0_STORAGE_KEY,
              JSON.stringify({ v: 1, profileCountry: code, channels: ch })
            )
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setChannels(ch)
      } catch {
        if (!cancelled) {
          setChannels(
            defaultChannelsForCountry(
              detectWizardCountry(searchParams, { acceptLanguage: acceptLanguageHint })
            )
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, acceptLanguageHint])

  useEffect(() => {
    if (!Number.isFinite(stepParam) || stepParam < 0 || stepParam > 5) return
    setCurrentStep(stepParam)
  }, [stepParam])

  useEffect(() => {
    if (!authJustCompleted) return
    if (stepParam !== 4) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete('authJustCompleted')
    const qs = params.toString()
    router.replace(`/create?${qs}`)
  }, [authJustCompleted, router, searchParams, stepParam])

  useEffect(() => {
    if (currentStep === 3 && isAuthenticated) setCurrentStep(4)
  }, [currentStep, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || currentStep < 4) {
      setPostAuthBusinessId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const tok = localStorage.getItem('book8_token')
        if (!tok) return
        const res = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${tok}` },
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        const list = data.businesses || []
        const first = list[0]
        const bid = first?.businessId || first?.id || null
        if (!cancelled && bid) setPostAuthBusinessId(bid)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, currentStep])

  useEffect(() => {
    if ((currentStep === 4 || currentStep === 5) && !isAuthenticated) setCurrentStep(3)
  }, [currentStep, isAuthenticated])

  const onStep2Continue = useCallback(() => {
    setCurrentStep(3)
  }, [])

  const onStep0Continue = useCallback((payload) => {
    setChannels(payload.channels)
    setCurrentStep(1)
    const params = new URLSearchParams(searchParams.toString())
    params.set('step', '1')
    router.replace(`/create?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const completedSteps = useMemo(() => {
    const s = new Set()
    if (currentStep >= 1) s.add(1)
    if (currentStep >= 2) s.add(2)
    if (currentStep >= 3) s.add(3)
    if (isAuthenticated && currentStep >= 4) s.add(4)
    if (currentStep >= 5) s.add(5)
    return s
  }, [currentStep, isAuthenticated])

  const title =
    currentStep === 0
      ? 'Business region'
      : currentStep === 2
        ? 'Customize your AI agent'
        : currentStep === 3
          ? 'Save your progress'
          : currentStep === 4
            ? voicePrimary
              ? 'Your AI is configured'
              : 'Almost ready on WhatsApp'
            : currentStep === 5
              ? voicePrimary
                ? 'Test your AI'
                : 'WhatsApp booking link'
              : 'Business profile'

  const subhead =
    currentStep === 0
      ? 'Choose where you operate so we can enable the right channels.'
      : currentStep === 2
        ? 'Set the voice, hours, and services your AI will use. You can change these anytime later.'
        : currentStep === 1
          ? "We'll infer details from your link—you can edit everything before continuing."
          : currentStep === 4
            ? voicePrimary
              ? 'Your receptionist is configured and ready. Here are some of its key abilities.'
              : 'Review what your AI can do on WhatsApp and other channels for your region.'
            : currentStep === 5
              ? voicePrimary
                ? "Coming soon: you'll be able to call a test number and hear your AI live."
                : 'Share your booking link and continue to finish account setup.'
              : voicePrimary
                ? "You're 2 minutes from your AI receptionist. Create a free account to keep your setup."
                : "You're almost there. Create a free account to keep your WhatsApp setup."

  return (
    <div className="min-h-dvh bg-[#0A0A0F] text-slate-100">
      <header className="border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/brand/book8_ai_logo.svg"
              alt="Book8"
              width={120}
              height={32}
              className="h-8 w-auto dark:brightness-0 dark:invert"
              priority
            />
          </Link>
          <ThemeToggle variant="landing" className="shrink-0" />
        </div>
      </header>

      <div className="lg:hidden border-b border-white/10 bg-[#0A0A0F]/70">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <WizardSidebar
            variant="mobile"
            currentStep={sidebarStep}
            completedSteps={completedSteps}
            totalSteps={6}
            voicePrimary={voicePrimary}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12">
        <aside className="hidden lg:block lg:w-72 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Step {sidebarStep} of 6
          </p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">{subhead}</p>
          <div className="mt-8">
            <WizardSidebar
              currentStep={sidebarStep}
              completedSteps={completedSteps}
              totalSteps={6}
              voicePrimary={voicePrimary}
            />
          </div>
        </aside>

        <main className={cn('min-w-0 flex-1', currentStep === 2 ? 'pb-10' : '')}>
          {currentStep === 0 ? (
            <Step0Country
              searchParams={searchParams}
              acceptLanguageHint={acceptLanguageHint}
              onContinue={onStep0Continue}
            />
          ) : currentStep === 1 ? (
            <Step1Profile
              descriptionParam={descriptionParam}
              verticalParam={verticalParam}
              onContinue={() => setCurrentStep(2)}
            />
          ) : currentStep === 2 ? (
            <Step2Agent
              descriptionParam={descriptionParam}
              verticalParam={verticalParam}
              voicePrimary={voicePrimary}
              onBack={() => setCurrentStep(1)}
              onContinue={onStep2Continue}
            />
          ) : currentStep === 3 ? (
            <Step3Account
              voicePrimary={voicePrimary}
              onBack={() => setCurrentStep(2)}
              onAuthSuccess={() => {
                try {
                  const t = localStorage.getItem('book8_token')
                  setAuthToken(t)
                } catch {
                  /* ignore */
                }
                setCurrentStep(4)
              }}
            />
          ) : currentStep === 4 ? (
            <Step4Skills
              channels={channels}
              voicePrimary={voicePrimary}
              onBack={() => setCurrentStep(3)}
              onContinue={() => setCurrentStep(5)}
            />
          ) : voicePrimary ? (
            <Step5Test
              onBack={() => setCurrentStep(4)}
              onContinueToSetup={() => router.push('/setup?profileSource=wizard')}
            />
          ) : (
            <Step5WhatsApp
              wizardSessionId={wizardSessionId}
              onBack={() => setCurrentStep(4)}
              onContinueToSetup={() => router.push('/setup?profileSource=wizard')}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function CreateWizardFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0A0A0F] text-slate-100">
      <div className="h-10 w-10 animate-pulse rounded-xl bg-white/10" aria-hidden />
    </div>
  )
}

export default function CreateWizardClient({ acceptLanguageHint = null }) {
  return (
    <Suspense fallback={<CreateWizardFallback />}>
      <CreateWizardInner acceptLanguageHint={acceptLanguageHint} />
    </Suspense>
  )
}
