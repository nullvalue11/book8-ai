'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useBookingLanguage } from '@/hooks/useBookingLanguage'

const GREETINGS = [
  { lang: 'English', text: 'Hi, how can I help?' },
  { lang: 'Arabic', text: 'مرحبا، كيف أساعدك؟' },
  { lang: 'French', text: 'Bonjour, comment puis-je vous aider?' },
  { lang: 'Spanish', text: '¡Hola! ¿En qué puedo ayudarle?' },
  { lang: 'Mandarin', text: '你好，有什么可以帮您？' },
  { lang: 'Portuguese', text: 'Olá! Como posso ajudar?' },
  { lang: 'Japanese', text: 'こんにちは、ご用件は？' },
  { lang: 'Hindi', text: 'नमस्ते, मैं कैसे मदद कर सकता हूँ?' },
  { lang: 'German', text: 'Hallo! Wie kann ich helfen?' },
  { lang: 'Indonesian', text: 'Halo, ada yang bisa saya bantu?' },
  { lang: 'Turkish', text: 'Merhaba, nasıl yardımcı olabilirim?' },
  { lang: 'Korean', text: '안녕하세요, 무엇을 도와드릴까요?' },
  { lang: 'Vietnamese', text: 'Xin chào, tôi có thể giúp gì?' },
  { lang: 'Swahili', text: 'Habari, nawezaje kukusaidia?' }
]

const STATS = [
  { n: '100%', l: 'Calls answered' },
  { n: '100%', l: 'Bookings handled' },
  { n: '24/7', l: 'Always on' },
  { n: '70+', l: 'Languages' }
]

const CONTINENT_DOTS =
  '30,80 40,80 50,80 60,80 35,90 45,90 55,90 65,90 75,90 30,100 40,100 50,100 60,100 70,100 35,110 45,110 55,110 65,110 40,120 50,120 60,120 45,130 55,130 50,140 55,150 90,75 100,75 95,85 105,85 90,95 100,95 95,105 100,110 90,115 100,115 110,115 95,125 105,125 100,135 105,140 130,80 140,80 150,80 160,80 170,80 180,80 190,80 200,80 210,80 220,80 135,90 145,90 155,90 165,90 175,90 185,90 195,90 205,90 215,90 225,90 130,100 140,100 150,100 160,100 170,100 180,100 190,100 200,100 210,100 220,100 135,110 145,110 155,110 165,110 175,110 185,110 195,110 205,110 215,110 145,120 155,120 165,120 175,120 185,120 195,120 165,130 175,130 185,130 165,140 175,140 195,160 205,160 215,160 200,170 210,170 205,180'

function GlobeFallback({ clipPathId }) {
  const continentDots = CONTINENT_DOTS.split(' ')
  return (
    <svg
      viewBox="0 0 260 260"
      width="260"
      height="260"
      className="w-full h-full max-w-[260px] max-h-[260px]"
      role="img"
      aria-label="Stylized globe showing global multilingual coverage"
    >
      <defs>
        <clipPath id={clipPathId}>
          <circle cx="130" cy="130" r="118" />
        </clipPath>
      </defs>

      <circle
        cx="130"
        cy="130"
        r="118"
        fill="rgba(248,250,252,0.85)"
        stroke="rgba(148,163,184,0.45)"
        className="dark:fill-[rgba(255,255,255,0.02)] dark:stroke-[rgba(255,255,255,0.15)]"
        strokeWidth="0.5"
      />

      <g
        stroke="rgba(148,163,184,0.35)"
        className="dark:stroke-[rgba(255,255,255,0.08)]"
        strokeWidth="0.5"
        fill="none"
        clipPath={`url(#${clipPathId})`}
      >
        <ellipse cx="130" cy="130" rx="118" ry="20" />
        <ellipse cx="130" cy="130" rx="118" ry="50" />
        <ellipse cx="130" cy="130" rx="118" ry="85" />
        <ellipse cx="130" cy="130" rx="40" ry="118" />
        <ellipse cx="130" cy="130" rx="80" ry="118" />
        <line x1="130" y1="12" x2="130" y2="248" />
        <line x1="12" y1="130" x2="248" y2="130" />
      </g>

      <g clipPath={`url(#${clipPathId})`}>
        {continentDots.map((coord, i) => {
          const [cx, cy] = coord.split(',')
          return (
            <circle
              key={`${cx}-${cy}-${i}`}
              cx={cx}
              cy={cy}
              r="1.5"
              fill="#22d3ee"
              opacity="0.65"
            />
          )
        })}
      </g>
    </svg>
  )
}

export default function GlobalCoverageSection() {
  const { language } = useBookingLanguage()
  const isRtl = language === 'ar'
  const rawId = useId()
  const clipPathId = `globe-sphere-clip-${rawId.replace(/:/g, '')}`
  const prefersReducedMotion = useReducedMotion()

  const [bubbles, setBubbles] = useState([GREETINGS[0], GREETINGS[1], GREETINGS[2], GREETINGS[3]])
  const [visibleBubbles, setVisibleBubbles] = useState([false, false, false, false])
  const [inViewport, setInViewport] = useState(false)
  const sectionRef = useRef(null)
  const idxRef = useRef(0)

  useEffect(() => {
    if (!sectionRef.current) return
    const obs = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), { threshold: 0.1 })
    obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!inViewport || prefersReducedMotion) {
      setVisibleBubbles([true, true, true, true])
      return
    }
    const timers = [0, 1, 2, 3].map((i) =>
      setTimeout(() => {
        setVisibleBubbles((prev) => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 400 + i * 220)
    )
    return () => timers.forEach(clearTimeout)
  }, [inViewport, prefersReducedMotion])

  useEffect(() => {
    if (!inViewport || prefersReducedMotion) return
    const interval = setInterval(() => {
      const slot = idxRef.current % 4
      setVisibleBubbles((prev) => {
        const next = [...prev]
        next[slot] = false
        return next
      })
      setTimeout(() => {
        idxRef.current++
        const nextGreeting = GREETINGS[(idxRef.current + 3) % GREETINGS.length]
        setBubbles((prev) => {
          const next = [...prev]
          next[slot] = nextGreeting
          return next
        })
        setVisibleBubbles((prev) => {
          const next = [...prev]
          next[slot] = true
          return next
        })
      }, 700)
    }, 2400)
    return () => clearInterval(interval)
  }, [inViewport, prefersReducedMotion])

  const bubblePositions = ['top-6 start-6', 'top-6 end-6', 'bottom-6 start-6', 'bottom-6 end-6']

  const globeInner = <GlobeFallback clipPathId={clipPathId} />

  return (
    <section
      ref={sectionRef}
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full border-b border-slate-200 bg-slate-50 py-16 px-4 dark:border-[rgba(139,92,246,0.08)] dark:bg-[#0B1020] md:px-8"
      aria-labelledby="global-coverage-heading"
    >
      <div className="mx-auto max-w-5xl">
        <span className="mb-4 inline-block rounded-full border border-slate-200 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:text-white/40">
          Always on, in every language
        </span>

        <h2
          id="global-coverage-heading"
          className="mb-4 text-3xl font-medium leading-tight tracking-tight text-slate-900 dark:text-white md:text-5xl"
        >
          <span className="block">Every call answered.</span>
          <span className="block">Every appointment booked.</span>
          <span className="block">
            <span className="bg-gradient-to-r from-[#38BDF8] to-[#34D399] bg-clip-text text-transparent">
              Any language
            </span>
            .
          </span>
          <span className="block">Around the clock.</span>
        </h2>

        <p className="mb-10 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-white/60 md:text-lg">
          Books appointments via phone, SMS, public link, and WhatsApp.
        </p>

        <div className="relative mb-6 flex h-[340px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/[0.02] md:h-[400px]">
          <div className="flex h-[200px] w-[200px] items-center justify-center md:h-[260px] md:w-[260px]">
            {prefersReducedMotion ? (
              globeInner
            ) : (
              <motion.div
                className="flex h-full w-full items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
              >
                {globeInner}
              </motion.div>
            )}
          </div>

          {bubbles.map((bub, i) => (
            <div
              key={i}
              className={`absolute ${bubblePositions[i]} max-w-[180px] rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-sm shadow-sm transition-all duration-500 dark:border-white/15 dark:bg-white/[0.04] ${
                visibleBubbles[i] ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
              }`}
              aria-hidden="true"
            >
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                {bub.lang}
              </div>
              <div className="font-medium leading-snug text-slate-900 dark:text-white">{bub.text}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 px-4 py-3.5 dark:border-white/10">
              <div className="text-2xl font-medium leading-none text-slate-900 dark:text-white">{s.n}</div>
              <div className="mt-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-white/50">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
