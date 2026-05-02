'use client'

import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { pricingPaywallUrl } from '@/lib/pricingPaywallUrl'

/**
 * Dims wrapped content and shows an upgrade chip when the feature is locked.
 */
export default function PlanFeatureLock({
  available,
  requiredPlan = 'Growth',
  businessId,
  children
}) {
  const router = useRouter()

  if (available) return children

  return (
    <div className="relative rounded-xl">
      <div className="pointer-events-none opacity-50 select-none">{children}</div>
      <button
        type="button"
        className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-full bg-brand-500/20 px-2.5 py-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 pointer-events-auto cursor-pointer hover:bg-brand-500/30 transition-colors"
        onClick={() => router.push(pricingPaywallUrl({ businessId }))}
      >
        <Lock className="w-3 h-3" aria-hidden />
        {requiredPlan}
      </button>
    </div>
  )
}
