'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const BASE_WIZARD_STEPS = [
  { title: 'Business region', short: 'Region' },
  { title: 'Business profile', short: 'Profile' },
  { title: 'Agent customization', short: 'Agent' },
  { title: 'Account setup', short: 'Account' },
  { title: 'Capabilities', short: 'Skills' },
  { title: 'Connect & continue', short: 'Connect' }
]

/**
 * @param {{ currentStep: number, completedSteps: Set<number>, variant?: 'desktop' | 'mobile', totalSteps?: number, voicePrimary?: boolean }} props
 * currentStep is 1-based (1 = country, …, 6 = test/WhatsApp).
 */
export default function WizardSidebar({
  currentStep,
  completedSteps,
  variant = 'desktop',
  totalSteps = 6,
  voicePrimary = true
}) {
  const completed = completedSteps || new Set()
  const steps = BASE_WIZARD_STEPS.map((s, i) =>
    i === BASE_WIZARD_STEPS.length - 1
      ? {
          ...s,
          short: voicePrimary ? 'Test' : 'WhatsApp',
          title: voicePrimary ? 'Test your AI' : 'WhatsApp booking'
        }
      : s
  )

  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
        {steps.map((s, idx) => {
          const stepNum = idx + 1
          const isCurrent = stepNum === currentStep
          const isCompleted = completed.has(stepNum)
          return (
            <div
              key={s.title}
              className={cn(
                'flex-none rounded-xl border px-3 py-2 text-sm',
                isCurrent
                  ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white'
                  : 'border-white/10 bg-white/[0.02] text-[#94A3B8]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
                      isCurrent
                        ? 'bg-[#8B5CF6] text-white'
                        : isCompleted
                          ? 'bg-[#16A34A]/20 text-[#86EFAC] border border-[#16A34A]/30'
                          : 'bg-[#1e293b] text-[#94A3B8]'
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                  </span>
                  <span className="font-medium truncate">{s.short}</span>
                </div>
                <span className="text-xs text-[#64748B] shrink-0">
                  {stepNum}/{totalSteps}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <nav className="space-y-2" aria-label="Wizard steps">
      {steps.map((s, i) => {
        const n = i + 1
        const isCurrent = n === currentStep
        const isCompleted = completed.has(n)
        return (
          <div
            key={s.title}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-sm transition-colors',
              isCurrent
                ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white'
                : 'border-white/5 bg-white/[0.02] text-[#64748B]'
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                  isCurrent
                    ? 'bg-[#8B5CF6] text-white'
                    : isCompleted
                      ? 'bg-[#16A34A]/20 text-[#86EFAC] border border-[#16A34A]/30'
                      : 'bg-[#1e293b] text-[#64748B]'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : n}
              </span>
              <span className="font-medium">{s.short}</span>
            </div>
            <p className="mt-1 pl-8 text-xs text-[#64748B]">{s.title}</p>
          </div>
        )
      })}
    </nav>
  )
}
