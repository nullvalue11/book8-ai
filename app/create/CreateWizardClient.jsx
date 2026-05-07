'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import WizardSidebar from './_components/WizardSidebar'
import Step1Profile from './_components/Step1Profile'
import Step2Agent from './_components/Step2Agent'

function CreateWizardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const descriptionParam = (searchParams.get('description') || '').trim()
  const verticalParam = (searchParams.get('vertical') || '').trim()

  const [currentStep, setCurrentStep] = useState(1)

  const onStep2Continue = useCallback(
    (encodedProfileData) => {
      router.push(`/signup?profileData=${encodeURIComponent(encodedProfileData)}`)
    },
    [router]
  )

  const completedSteps = useMemo(() => new Set(currentStep > 1 ? [1] : []), [currentStep])

  const title =
    currentStep === 2 ? 'Customize your AI agent' : currentStep === 1 ? 'Business profile' : 'Create'
  const subhead =
    currentStep === 2
      ? 'Set the voice, hours, and services your AI will use. You can change these anytime later.'
      : "We'll infer details from your link—you can edit everything before continuing."

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
          ) : (
            <Step2Agent
              descriptionParam={descriptionParam}
              verticalParam={verticalParam}
              onBack={() => setCurrentStep(1)}
              onContinue={onStep2Continue}
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

