'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const STEPS = [
  'Visiting your website…',
  'Reading your services page…',
  'Finding your business hours…',
  'Extracting your contact info…',
  'Almost done — preparing your wizard…'
]

/**
 * @param {{ displayHost: string, done: boolean, longWait: boolean }} props
 */
export default function ExtractionProgress({ displayHost, done, longWait }) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (done) {
      setStepIndex(STEPS.length - 1)
      return undefined
    }
    const tick = longWait ? 4000 : 2600
    const id = window.setInterval(() => {
      setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
    }, tick)
    return () => window.clearInterval(id)
  }, [done, longWait])

  const progress = useMemo(() => {
    if (done) return 100
    const base = (stepIndex + 1) / STEPS.length
    return Math.min(92, Math.round(base * 100))
  }, [stepIndex, done])

  const label = longWait && !done ? 'Almost done — finalizing your details…' : STEPS[stepIndex]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#06060f]/92 px-4 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-1/4 left-1/4 h-[50vh] w-[50vh] -translate-x-1/2 rounded-full opacity-40 blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 h-[40vh] w-[40vh] rounded-full opacity-30 blur-[90px]"
          style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.4), transparent 70%)' }}
        />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative z-[1] w-full max-w-md rounded-2xl border border-[rgba(139,92,246,0.25)]',
          'bg-[#12121A]/95 p-6 shadow-[0_0_60px_-12px_rgba(139,92,246,0.45)] sm:p-8'
        )}
      >
        <p className="text-center text-xs font-medium text-[#A78BFA]">
          Reading: <span className="text-white">{displayHost}</span>
        </p>
        <div className="mt-6 min-h-[3.5rem] text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-base font-medium leading-snug text-white"
            >
              {label}
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#A78BFA]" aria-hidden />
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-[#1e1e2e]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  )
}
