'use client'

import { cn } from '@/lib/utils'

const PALETTE_STYLES = {
  cyan: 'from-[#0EE6CC]/40 via-[#3AB4FF]/30 to-[#1E4A8C]/50 shadow-[0_0_60px_-12px_rgba(14,230,204,0.55)]',
  bronze: 'from-[#E8C094]/40 via-[#C8A57F]/30 to-[#7A5232]/50 shadow-[0_0_60px_-12px_rgba(232,192,148,0.45)]'
}

/**
 * CSS fallback when WebGL is unavailable or while the Canvas bundle loads.
 * @param {{ palette?: 'cyan' | 'bronze', className?: string }} props
 */
export default function OrbStaticFallback({ palette = 'cyan', className = '' }) {
  const grad = PALETTE_STYLES[palette] || PALETTE_STYLES.cyan
  return (
    <div
      className={cn(
        'h-full w-full rounded-full bg-gradient-to-br',
        grad,
        'ring-1 ring-white/10',
        className
      )}
      aria-hidden
    />
  )
}
