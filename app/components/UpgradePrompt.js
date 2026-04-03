'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Shown when a feature requires a higher plan.
 */
export default function UpgradePrompt({
  feature,
  currentPlan = 'Starter',
  requiredPlan = 'Growth',
  className = ''
}) {
  return (
    <div
      className={`rounded-xl border border-brand-500/25 bg-brand-500/10 px-5 py-5 text-center ${className}`}
    >
      <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
        {feature} requires the {requiredPlan} plan
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {currentPlan === 'No plan' ? (
          <>You don&apos;t have an active subscription yet. Choose a plan to unlock this feature.</>
        ) : (
          <>You&apos;re on the {currentPlan} plan. Upgrade to unlock this feature.</>
        )}
      </p>
      <Button asChild className="mt-4 bg-brand-600 hover:bg-brand-700 text-white">
        <Link href="/pricing">Upgrade plan</Link>
      </Button>
    </div>
  )
}
