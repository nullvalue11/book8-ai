'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import WizardSidebar from './_components/WizardSidebar'
import Step1Profile from './_components/Step1Profile'
import Step2Agent from './_components/Step2Agent'
import Step3Account from './_components/Step3Account'
import Step4Skills from './_components/Step4Skills'
import Step5Test from './_components/Step5Test'

function CreateWizardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const descriptionParam = (searchParams.get('description') || '').trim()
  const verticalParam = (searchParams.get('vertical') || '').trim()

  const [currentStep, setCurrentStep] = useState(1)
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

  // Detect auth (custom token stored by existing auth flows).
  useEffect(() => {
    // Keep auth state in sync across OAuth navigations.
    try {
      const t = localStorage.getItem('book8_token')
      setAuthToken(t)
    } catch {
      /* ignore */
    }
  }, [])

  // Support OAuth return deep link.
  useEffect(() => {
    if (!Number.isFinite(stepParam) || stepParam < 1 || stepParam > 5) return
    setCurrentStep(stepParam)
  }, [stepParam])

  useEffect(() => {
    if (!authJustCompleted) return
    if (stepParam !== 4) return

    // Keep `step=4` so refresh lands on Step 4, but remove the one-time flag.
    const params = new URLSearchParams(searchParams.toString())
    params.delete('authJustCompleted')
    const qs = params.toString()
    router.replace(`/create?${qs}`)
  }, [authJustCompleted, router, searchParams, stepParam])

  // Skip Step 3 if already logged in.
  useEffect(() => {
    if (currentStep === 3 && isAuthenticated) setCurrentStep(4)
  }, [currentStep, isAuthenticated])

  // Guard steps 4–5.
  useEffect(() => {
    if ((currentStep === 4 || currentStep === 5) && !isAuthenticated) setCurrentStep(3)
  }, [currentStep, isAuthenticated])

  const onStep2Continue = useCallback(
    () => {
      // Step 2 already persists the merged profile into sessionStorage.
      setCurrentStep(3)
    },
    []
  )

  const completedSteps = useMemo(() => {
    const s = new Set()
    if (currentStep > 1) s.add(1)
    if (currentStep > 2) s.add(2)
    if (isAuthenticated && currentStep >= 3) s.add(3)
    if (currentStep >= 5) s.add(4)
    return s
  }, [currentStep, isAuthenticated])

  const title =
    currentStep === 2
      ? 'Customize your AI agent'
      : currentStep === 3
        ? 'Save your progress'
        : currentStep === 4
          ? 'Your AI is configured'
          : currentStep === 5
            ? 'Test your AI'
            : 'Business profile'

  const subhead =
    currentStep === 2
      ? 'Set the voice, hours, and services your AI will use. You can change these anytime later.'
      : currentStep === 1
        ? "We'll infer details from your link—you can edit everything before continuing."
        : currentStep === 4
          ? "Your receptionist is configured and ready. Here are some of its key abilities."
          : currentStep === 5
            ? "Coming soon: you'll be able to call a test number and hear your AI live."
            : "You're 2 minutes from your AI receptionist. Create a free account to keep your setup."

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

      {/* Mobile stepper */}
      <div className="lg:hidden border-b border-white/10 bg-[#0A0A0F]/70">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <WizardSidebar
            variant="mobile"
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12">
        <aside className="hidden lg:block lg:w-72 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Step {currentStep} of 7
          </p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">{title}</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">{subhead}</p>
          <div className="mt-8">
            <WizardSidebar currentStep={currentStep} completedSteps={completedSteps} />
          </div>
        </aside>

        <main className={cn('min-w-0 flex-1', currentStep === 2 ? 'pb-10' : '')}>
          {currentStep === 1 ? (
            <Step1Profile
              descriptionParam={descriptionParam}
              verticalParam={verticalParam}
              onContinue={() => setCurrentStep(2)}
            />
          ) : currentStep === 2 ? (
            <Step2Agent
              descriptionParam={descriptionParam}
              verticalParam={verticalParam}
              onBack={() => setCurrentStep(1)}
              onContinue={onStep2Continue}
            />
          ) : currentStep === 3 ? (
            <Step3Account
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
            <Step4Skills onBack={() => setCurrentStep(3)} onContinue={() => setCurrentStep(5)} />
          ) : (
            <Step5Test
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

export default function CreateWizardClient() {
  return (
    <Suspense fallback={<CreateWizardFallback />}>
      <CreateWizardInner />
    </Suspense>
  )
}

