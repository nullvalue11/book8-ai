'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import OrbStaticFallback from './OrbStaticFallback'

const OrbCanvas = dynamic(() => import('./OrbCanvas'), {
  ssr: false,
  loading: () => null
})

function canUseWebGL() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

/**
 * @param {{
 *   size?: 'large' | 'medium' | 'small',
 *   palette?: 'cyan' | 'bronze',
 *   onClick?: () => void,
 *   ariaLabel?: string,
 *   className?: string
 * }} props
 */
export default function AnimatedAIOrb({
  size = 'large',
  palette = 'cyan',
  onClick,
  ariaLabel = 'AI assistant orb',
  className = ''
}) {
  const reduceMotion = useReducedMotion()
  const [webglOk, setWebglOk] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setWebglOk(canUseWebGL())
  }, [])

  const sizeMap = {
    large:
      'w-[min(100%,400px)] h-[min(100vw-2rem,400px)] md:w-[500px] md:h-[500px] min-h-[280px] min-w-[280px]',
    medium:
      'w-[min(100%,300px)] h-[min(100vw-2rem,300px)] sm:w-[300px] sm:h-[300px] min-h-[220px] min-w-[220px]',
    small: 'w-[200px] h-[200px] min-h-[200px] min-w-[200px]'
  }

  const handleKeyDown = useCallback(
    (e) => {
      if (!onClick) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    },
    [onClick]
  )

  const showCanvas = mounted && webglOk
  const animate = !reduceMotion

  return (
    <div
      className={cn(
        'relative mx-auto shrink-0',
        sizeMap[size],
        onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full' : '',
        className
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : 'img'}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
    >
      {showCanvas ? (
        <div className="absolute inset-0">
          <OrbCanvas palette={palette} animate={animate} />
        </div>
      ) : (
        <OrbStaticFallback palette={palette} />
      )}
    </div>
  )
}
