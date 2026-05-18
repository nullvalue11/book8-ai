'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DISPLAY_CURRENCIES, normalizeDisplayCurrency } from '@/lib/pricing-display-currencies'

/**
 * @param {{ currentCurrency?: string }} props
 */
export default function CurrencyToggle({ currentCurrency = 'USD' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const active = normalizeDisplayCurrency(currentCurrency)

  const handleChange = (newCurrency) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('currency', normalizeDisplayCurrency(newCurrency))
    params.delete('country')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div
      className="inline-flex rounded-full border border-border bg-muted/50 p-1"
      role="group"
      aria-label="Select currency"
    >
      {DISPLAY_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => handleChange(c)}
          aria-pressed={active === c}
          className={`min-w-[4.5rem] px-4 py-1.5 text-sm font-medium rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            active === c
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}
