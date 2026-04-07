'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  Globe,
  Menu,
  X,
  Phone,
  Calendar,
  Sparkles,
  Scissors,
  Stethoscope,
  Dumbbell,
  PenTool,
  PawPrint,
  Zap,
  Rocket,
  Building2,
  CheckCircle2
} from 'lucide-react'
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import PricingPlanFeatureList from '@/components/PricingPlanFeatureList'
import ThemeToggle from '@/components/ThemeToggle'
import HeaderLogo from '@/components/HeaderLogo'
import LanguageSelector from '@/components/LanguageSelector'
import SocialMediaLinks from '@/components/SocialMediaLinks'
import { SETUP_NEW_BUSINESS_PATH, setupUrlWithNewBusiness } from '@/lib/setup-entry'
import { useBookingLanguage } from '@/hooks/useBookingLanguage'
import { getHomepagePricingDisplay, trFormat, bookingLocaleBcp47 } from '@/lib/translations'

const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-brico',
  display: 'swap'
})

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap'
})

const reveal = {
  hidden: { opacity: 0, y: 44 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] }
  }
}

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } }
}

function Aurora() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -top-1/4 start-1/4 h-[60vh] w-[60vh] rounded-full blur-[120px] opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.55), transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 end-0 h-[50vh] w-[50vh] rounded-full blur-[100px] opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.45), transparent 70%)' }}
      />
      <div
        className="absolute top-1/2 start-1/2 h-[40vh] w-[40vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.35), transparent 65%)' }}
      />
    </div>
  )
}

function Particles() {
  const dots = useMemo(() => Array.from({ length: 48 }, (_, i) => i), [])
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-[0.35]"
      aria-hidden
    >
      {dots.map((i) => (
        <div
          key={i}
          className="absolute rounded-full bg-[#A78BFA]"
          style={{
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            left: `${(i * 7.3) % 100}%`,
            top: `${(i * 11.7) % 100}%`,
            opacity: 0.15 + (i % 5) * 0.05
          }}
        />
      ))}
    </div>
  )
}

function GlowCard({ children, className = '', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{
        opacity: { delay: delay * 0.15 + 0.3, duration: 0.5 },
        y: { delay: delay * 0.15 + 0.5, duration: 4, repeat: Infinity, ease: 'easeInOut' }
      }}
      className={`relative rounded-2xl border border-[rgba(139,92,246,0.35)] bg-[#121228]/95 p-4 shadow-[0_0_40px_-12px_rgba(139,92,246,0.55)] backdrop-blur-md ${className}`}
      style={{
        boxShadow:
          '0 0 0 1px rgba(139,92,246,0.2), 0 0 32px -8px rgba(139,92,246,0.35), 0 25px 50px -12px rgba(0,0,0,0.55)'
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[rgba(139,92,246,0.12)] to-transparent opacity-70" />
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  )
}

function SvgSetup() {
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[140px] mx-auto text-[#A78BFA]" aria-hidden>
      <motion.rect
        x="20"
        y="28"
        width="80"
        height="56"
        rx="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      <motion.line x1="32" y1="44" x2="88" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.6 }} />
      <motion.line x1="32" y1="58" x2="72" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.5 }} />
      <motion.circle cx="60" cy="78" r="6" fill="#34D399" initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.8, type: 'spring' }} />
    </svg>
  )
}

function SvgPhoneWave() {
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[140px] mx-auto text-[#A78BFA]" aria-hidden>
      <rect x="38" y="22" width="44" height="78" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <motion.path
        d="M24 70 Q32 50 40 70 T56 70"
        fill="none"
        stroke="#34D399"
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{ d: ['M24 70 Q32 50 40 70 T56 70', 'M24 70 Q32 90 40 70 T56 70', 'M24 70 Q32 50 40 70 T56 70'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M62 70 Q70 42 78 70 T94 70"
        fill="none"
        stroke="#34D399"
        strokeWidth="2.5"
        strokeLinecap="round"
        animate={{ d: ['M62 70 Q70 42 78 70 T94 70', 'M62 70 Q70 98 78 70 T94 70', 'M62 70 Q70 42 78 70 T94 70'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }}
      />
    </svg>
  )
}

function SvgCalendarCheck() {
  return (
    <svg viewBox="0 0 120 120" className="w-full max-w-[140px] mx-auto text-[#A78BFA]" aria-hidden>
      <rect x="28" y="32" width="64" height="56" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="28" y1="48" x2="92" y2="48" stroke="currentColor" strokeWidth="2" />
      <motion.path
        d="M46 68 L54 78 L76 56"
        fill="none"
        stroke="#34D399"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  )
}

function useMonthGrid(year, month) {
  return useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const pad = first.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells = []
    for (let i = 0; i < pad; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])
}

const ORBIT_LANGS = ['English', 'Français', 'Español', 'العربية', '中文', 'Deutsch']

export default function LandingPage() {
  const { language, setLanguage, t } = useBookingLanguage()
  const h = t.homepage
  const isRtl = language === 'ar'
  const [navSolid, setNavSolid] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const calCells = useMonthGrid(2026, 4)
  const calHeaders = [h.calSun, h.calMon, h.calTue, h.calWed, h.calThu, h.calFri, h.calSat]

  const mockSlotTimes = useMemo(() => {
    const loc = bookingLocaleBcp47(language)
    return [9, 10, 11, 12, 13, 14, 15, 16].map((hour) =>
      new Date(2000, 0, 1, hour, 0, 0).toLocaleTimeString(loc, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    )
  }, [language])

  const onScroll = useCallback(() => {
    setNavSolid(typeof window !== 'undefined' && window.scrollY > 50)
  }, [])

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      document.documentElement.style.scrollBehavior = ''
    }
  }, [onScroll])

  useEffect(() => {
    const prevDir = document.documentElement.getAttribute('dir')
    const prevLang = document.documentElement.getAttribute('lang')
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', language || 'en')
    return () => {
      if (prevDir) document.documentElement.setAttribute('dir', prevDir)
      else document.documentElement.removeAttribute('dir')
      if (prevLang) document.documentElement.setAttribute('lang', prevLang)
    }
  }, [isRtl, language])

  const pricingTiers = [
    {
      planId: 'starter',
      icon: Zap,
      name: h.starter,
      price: '$29',
      sub: h.perMonth,
      desc: h.individualsSmallBiz,
      cta: h.landingGetStarted,
      href: setupUrlWithNewBusiness({ plan: 'starter' }),
      highlight: false
    },
    {
      planId: 'growth',
      icon: Rocket,
      name: h.growth,
      price: '$99',
      sub: h.monthlyAfterTrial,
      desc: h.landingGrowthCardDesc,
      cta: h.landingGetStartedGrowth,
      href: setupUrlWithNewBusiness({ plan: 'growth' }),
      highlight: true,
      badge: h.mostPopular
    },
    {
      planId: 'enterprise',
      icon: Building2,
      name: h.enterprise,
      price: '$299',
      sub: h.perMonthPerLocation,
      desc: h.largeTeamsCustom,
      cta: h.landingGetStarted,
      href: setupUrlWithNewBusiness({ plan: 'enterprise' }),
      highlight: false
    }
  ]

  const featuresThree = [
    {
      overline: h.feat1Overline,
      title: h.feat1Title,
      desc: h.feat1Desc,
      reverse: false
    },
    {
      overline: h.feat2Overline,
      title: h.feat2Title,
      desc: h.feat2Desc,
      reverse: true
    },
    {
      overline: h.feat3Overline,
      title: h.feat3Title,
      desc: h.feat3Desc,
      reverse: false
    }
  ]

  const multilingTags = [
    'English',
    'Français',
    'Español',
    'العربية',
    '中文',
    'Deutsch',
    'Português',
    '日本語',
    '한국어',
    'हिन्दी'
  ]

  const rootCls = `${fontDisplay.variable} ${fontSans.variable} font-[family-name:var(--font-jakarta)] text-[#EEEDF5] antialiased`

  return (
    <main
      id="main-content"
      className={`relative isolate min-h-dvh min-h-screen overflow-x-hidden ${rootCls}`}
      style={{ background: 'linear-gradient(180deg, #06060f 0%, #0b0b1a 40%, #06060f 100%)' }}
      lang={language}
    >
      <Aurora />
      <Particles />

      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          navSolid ? 'border-b border-[rgba(139,92,246,0.12)] bg-[#06060f]/80 backdrop-blur-xl' : 'bg-transparent'
        }`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 shrink-0 text-white">
            <HeaderLogo variant="light" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#9593A8]">
            <a href="#features" className="hover:text-white transition-colors">
              {h.navFeatures}
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              {h.navHowItWorks}
            </a>
            <Link href="/pricing" className="hover:text-white transition-colors">
              {h.navPricing}
            </Link>
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle variant="landing" className="shrink-0" />
            <LanguageSelector value={language} onChange={setLanguage} t={t} variant="dark" />
            <Link
              href="/#auth"
              className="hidden sm:inline text-sm text-[#9593A8] hover:text-white px-2"
            >
              {h.navSignIn}
            </Link>
            <Link href={SETUP_NEW_BUSINESS_PATH}>
              <Button className="rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_24px_-4px_rgba(139,92,246,0.7)]">
                {h.getStarted}
              </Button>
            </Link>
            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-white border border-white/10"
              aria-label={h.toggleMenu}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <div className="md:hidden border-t border-[rgba(139,92,246,0.12)] bg-[#0b0b1a] px-4 py-4 flex flex-col gap-3 text-[#9593A8]">
            <a href="#features" className="py-2" onClick={() => setMobileOpen(false)}>
              {h.navFeatures}
            </a>
            <a href="#how-it-works" className="py-2" onClick={() => setMobileOpen(false)}>
              {h.navHowItWorks}
            </a>
            <Link href="/pricing" className="py-2" onClick={() => setMobileOpen(false)}>
              {h.navPricing}
            </Link>
            <Link href="/#auth" className="py-2 text-white" onClick={() => setMobileOpen(false)}>
              {h.navSignIn}
            </Link>
          </div>
        ) : null}
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center max-w-3xl mx-auto mb-12 md:mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
          >
            <motion.p
              variants={reveal}
              className="text-xs uppercase tracking-[0.2em] text-[#A78BFA] mb-4 font-semibold"
            >
              {h.heroKicker}
            </motion.p>
            <motion.h1
              variants={reveal}
              className="text-[2.25rem] leading-tight md:text-5xl lg:text-6xl font-extrabold text-white font-[family-name:var(--font-brico)]"
            >
              {h.heroTitle1} {h.heroTitle2}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] to-[#34D399]">
                {h.heroTitle3} {h.heroTitle4}
              </span>
            </motion.h1>
            <motion.p
              variants={reveal}
              className="mt-6 text-base md:text-lg text-[#9593A8] max-w-2xl mx-auto leading-relaxed"
            >
              {h.heroSubtitle}
            </motion.p>
            <motion.div
              variants={reveal}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center"
            >
              <Link href={SETUP_NEW_BUSINESS_PATH} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-12 md:h-14 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-base shadow-[0_0_40px_-8px_rgba(139,92,246,0.8)]"
                >
                  {h.getStartedFree}
                </Button>
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 text-[#9593A8] hover:text-white transition-colors py-3"
              >
                {h.seeHowItWorks}
                <ChevronDown className="w-4 h-4 animate-bounce rtl:rotate-180" aria-hidden />
              </a>
            </motion.div>
          </motion.div>

          {/* Browser mockup + floaters */}
          <div className="relative max-w-5xl mx-auto">
            <div className="hidden lg:block absolute -top-8 start-0 z-20 w-64">
              <GlowCard delay={0}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#34D399] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#EEEDF5] leading-snug">{h.floatCardConfirmed}</p>
                </div>
              </GlowCard>
            </div>
            <div className="hidden lg:block absolute -top-6 end-0 z-20 w-60">
              <GlowCard delay={1}>
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#EEEDF5] leading-snug">{h.floatCardLang}</p>
                </div>
              </GlowCard>
            </div>

            <motion.div
              className="rounded-2xl border border-[rgba(139,92,246,0.18)] bg-[#121228] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.85)] overflow-hidden"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-[#1a1a3a] border-b border-[rgba(139,92,246,0.08)]">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                  <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                  <span className="w-3 h-3 rounded-full bg-[#28C840]" />
                </div>
                <div className="hidden md:flex flex-1 justify-center min-w-0">
                  <span className="text-[11px] md:text-xs text-[#68668A] bg-[#0b0b1a] px-4 py-1.5 rounded-lg truncate max-w-[min(100%,420px)] border border-[rgba(139,92,246,0.08)]">
                    {h.mockUrlDisplay}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="p-6 md:p-8 border-e border-[rgba(139,92,246,0.08)] space-y-5">
                  <div>
                    <h3 className="text-xl font-bold text-white font-[family-name:var(--font-brico)]">
                      {h.mockBusinessName}
                    </h3>
                    <p className="text-sm text-[#9593A8]">{h.mockBusinessTagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[h.mockServiceCleaning, h.mockServiceWhitening, h.mockServiceCheckup, h.mockServiceFilling, h.mockServiceConsult].map((label) => (
                      <span
                        key={label}
                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-[rgba(139,92,246,0.15)] text-[#D4C4FC] border border-[rgba(139,92,246,0.25)]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-[#68668A] mb-2 uppercase tracking-wide">{h.mockContactLabel}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-3">
                      {[
                        { src: '/images/providers/john-dentist.png', alt: 'Dr. John', label: h.mockProviderJohn },
                        { src: '/images/providers/rashad-dentist.png', alt: 'Dr. Rashad', label: h.mockProviderRashad },
                        { src: '/images/providers/amanda-hygienist.png', alt: 'Amanda', label: h.mockProviderAmanda },
                        { src: '/images/providers/britney-hygienist.png', alt: 'Britney', label: h.mockProviderBritney }
                      ].map((p) => (
                        <div
                          key={p.src}
                          className="flex flex-col items-center gap-1.5 w-16 shrink-0"
                        >
                          <div
                            className="w-11 h-11 rounded-[10px] overflow-hidden shadow-lg bg-[#1a1a3a]"
                            title={p.alt}
                          >
                            <img
                              src={p.src}
                              alt={p.alt}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                borderRadius: '10px'
                              }}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] text-[#9593A8] text-center leading-snug font-medium w-full">
                            {p.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#9593A8]">
                    <Phone className="w-4 h-4 text-[#A78BFA]" />
                    <span>+1 (555) 010‑0142</span>
                  </div>
                </div>
                <div className="p-6 md:p-8 bg-[#0b0b1a]/40">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-white">{h.mockCalendarTitle}</p>
                    <span className="text-xs px-2 py-1 rounded-md bg-[#1a1a3a] text-[#A78BFA] border border-[rgba(139,92,246,0.2)]">
                      {h.mockLangBadge}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-4">
                    {calHeaders.map((d) => (
                      <div key={d} className="text-center text-[10px] md:text-xs text-[#68668A] py-1.5">
                        {d}
                      </div>
                    ))}
                    {calCells.map((day, i) => {
                      const isSel = day === 15
                      return (
                        <div
                          key={i}
                          className={`aspect-square rounded-full flex items-center justify-center text-xs md:text-sm ${
                            day == null
                              ? ''
                              : isSel
                                ? 'bg-[#8B5CF6] text-white font-semibold shadow-[0_0_20px_-4px_rgba(139,92,246,0.9)]'
                                : 'text-[#9593A8] hover:bg-white/5'
                          }`}
                        >
                          {day ?? ''}
                        </div>
                      )
                    })}
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mb-6">
                    {mockSlotTimes.map((time) => (
                      <button
                        key={time}
                        type="button"
                        className="py-2.5 rounded-xl border border-[rgba(139,92,246,0.12)] text-xs md:text-sm font-medium text-[#EEEDF5] bg-[#121228] hover:border-[#8B5CF6]/50 transition-colors min-h-[44px]"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                  <Button className="w-full h-12 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
                    {h.mockBookCta}
                  </Button>
                </div>
              </div>
            </motion.div>

            <div className="hidden lg:block absolute -bottom-6 start-8 z-20 w-52">
              <GlowCard delay={2}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-0.5 items-end h-6">
                    {[4, 7, 5, 9, 6, 8].map((hgt, i) => (
                      <motion.span
                        key={i}
                        className="w-1 rounded-full bg-[#34D399]"
                        animate={{ height: [hgt * 2, hgt * 2.6, hgt * 2] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.08 }}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-medium text-[#EEEDF5]">{h.floatCardAi}</p>
                </div>
              </GlowCard>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof */}
      <motion.section
        className="py-10 border-y border-[rgba(139,92,246,0.08)]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        variants={stagger}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-6xl px-4">
          <motion.p variants={reveal} className="text-center text-sm text-[#68668A] mb-6">
            {h.socialProofHeadline}
          </motion.p>
          <motion.div
            variants={reveal}
            className="flex flex-wrap justify-center gap-x-10 gap-y-4 text-[#9593A8] text-sm"
          >
            {[
              { icon: Stethoscope, label: h.dentalClinics },
              { icon: Scissors, label: h.barbers },
              { icon: Sparkles, label: h.spas },
              { icon: Dumbbell, label: h.fitnessStudios },
              { icon: PenTool, label: h.tattooShops },
              { icon: PawPrint, label: h.vetClinics }
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#A78BFA]" aria-hidden />
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Features */}
      <section
        id="features"
        className="relative overflow-hidden py-20 md:py-28 px-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-6xl space-y-20 md:space-y-28">
          {featuresThree.map((f, i) => (
            <motion.div
              key={f.title}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                f.reverse ? 'lg:flex-row-reverse' : ''
              }`}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              variants={stagger}
            >
              <motion.div
                variants={reveal}
                className={f.reverse ? 'lg:order-2' : ''}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#A78BFA] mb-2">
                  {f.overline}
                </p>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-[family-name:var(--font-brico)]">
                  {f.title}
                </h2>
                <p className="text-[#9593A8] leading-relaxed text-base md:text-lg">{f.desc}</p>
              </motion.div>
              <motion.div
                variants={reveal}
                className={`rounded-2xl border border-[rgba(139,92,246,0.15)] bg-[#121228] p-10 min-h-[220px] flex items-center justify-center ${
                  f.reverse ? 'lg:order-1' : ''
                }`}
                aria-label={h.featA11yLabel}
              >
                <div className="text-[#A78BFA] text-6xl opacity-40">
                  {i === 0 ? <Phone className="w-24 h-24 mx-auto" /> : null}
                  {i === 1 ? <Globe className="w-24 h-24 mx-auto" /> : null}
                  {i === 2 ? <Calendar className="w-24 h-24 mx-auto" /> : null}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative overflow-hidden py-20 md:py-28 px-4 bg-[#0b0b1a]/50 border-y border-[rgba(139,92,246,0.08)]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2
              variants={reveal}
              className="text-3xl md:text-4xl font-bold text-white font-[family-name:var(--font-brico)]"
            >
              {h.howItWorks}
            </motion.h2>
            <motion.p variants={reveal} className="mt-4 text-[#9593A8]">
              {h.howItWorksLead}
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: 1, title: h.step1Title, desc: h.step1Desc, Svg: SvgSetup },
              { n: 2, title: h.step2Title, desc: h.step2Desc, Svg: SvgPhoneWave },
              { n: 3, title: h.step3Title, desc: h.step3Desc, Svg: SvgCalendarCheck }
            ].map(({ n, title, desc, Svg }) => (
              <motion.div
                key={n}
                className="relative overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[#121228] p-8 pt-10"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={reveal}
              >
                <div className="absolute -top-3 start-6 w-9 h-9 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center text-sm font-bold text-white shadow-lg">
                  {n}
                </div>
                <div className="mb-6 min-h-[120px] flex items-center justify-center">
                  <Svg />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-[family-name:var(--font-brico)]">
                  {title}
                </h3>
                <p className="text-sm text-[#9593A8] leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Multilingual */}
      <section className="py-20 md:py-28 px-4 overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={reveal} className="text-3xl md:text-4xl font-bold text-white font-[family-name:var(--font-brico)]">
              {h.multilingTitle}
            </motion.h2>
            <motion.p variants={reveal} className="mt-4 text-[#9593A8]">
              {h.multilingSubtitle}
            </motion.p>
          </motion.div>
          <div className="relative h-72 w-72 mx-auto mb-12">
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-dashed border-[rgba(139,92,246,0.3)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-10 rounded-full border border-[rgba(139,92,246,0.15)]"
              animate={{ rotate: -360 }}
              transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#1a1a3a] via-[#121228] to-[#0b0b1a] border border-[rgba(139,92,246,0.35)] shadow-[0_0_60px_-10px_rgba(139,92,246,0.6)] flex items-center justify-center">
                <Globe className="w-12 h-12 text-[#A78BFA]" />
              </div>
            </div>
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            >
              {ORBIT_LANGS.map((label, idx) => {
                const angle = (idx / ORBIT_LANGS.length) * 2 * Math.PI - Math.PI / 2
                const r = 118
                const x = Math.cos(angle) * r
                const y = Math.sin(angle) * r
                return (
                  <span
                    key={label}
                    className="absolute left-1/2 top-1/2 text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#1a1a3a] text-[#D4C4FC] border border-[rgba(139,92,246,0.35)] shadow-lg whitespace-nowrap"
                    style={{
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                    }}
                  >
                    {label}
                  </span>
                )
              })}
            </motion.div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
            {multilingTags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1.5 rounded-full bg-[#121228] border border-[rgba(139,92,246,0.12)] text-[#9593A8]"
              >
                {tag}
              </span>
            ))}
            <span className="text-xs px-3 py-1.5 rounded-full bg-[rgba(139,92,246,0.15)] text-[#D4C4FC] border border-[rgba(139,92,246,0.3)]">
              {h.multilingMore}
            </span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-28 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={reveal} className="text-3xl md:text-4xl font-bold text-white font-[family-name:var(--font-brico)]">
              {h.simplePricing}
            </motion.h2>
            <motion.p variants={reveal} className="mt-3 text-sm text-[#9593A8]">
              {h.plansFrom}{' '}
              <Link href="/pricing" className="text-[#A78BFA] hover:underline">
                {h.compareDetails}
              </Link>
            </motion.p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {pricingTiers.map((tier) => {
              const Icon = tier.icon
              const override = getHomepagePricingDisplay(h, tier.planId)
              return (
                <motion.div
                  key={tier.planId}
                  className={`rounded-2xl border p-6 md:p-8 flex flex-col relative ${
                    tier.highlight
                      ? 'border-[#8B5CF6]/60 bg-[#121228] shadow-[0_0_50px_-12px_rgba(139,92,246,0.55)] md:scale-[1.02]'
                      : 'border-[rgba(139,92,246,0.12)] bg-[#121228]/80'
                  }`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7 }}
                >
                  {tier.badge ? (
                    <span className="absolute top-4 end-4 text-[10px] font-bold uppercase tracking-wide text-[#C4B5FD] bg-[rgba(139,92,246,0.25)] px-2 py-1 rounded-md border border-[rgba(139,92,246,0.35)]">
                      {tier.badge}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.2)] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#A78BFA]" aria-hidden />
                    </div>
                    <h3 className="text-xl font-bold text-white font-[family-name:var(--font-brico)]">{tier.name}</h3>
                  </div>
                  <p className="text-xs text-[#68668A] mb-3 min-h-[2.5rem]">{tier.desc}</p>
                  <p className="text-3xl font-bold text-white mb-1">
                    {tier.price}
                    <span className="text-base font-medium text-[#9593A8]"> {tier.sub}</span>
                  </p>
                  {tier.planId === 'growth' ? (
                    <p className="text-xs text-[#34D399] mb-4 font-medium">{h.growthTrialIncluded}</p>
                  ) : (
                    <div className="mb-4 h-4" />
                  )}
                  <PricingPlanFeatureList planId={tier.planId} theme="landing" override={override} />
                  <Link href={tier.href} className="mt-auto">
                    <Button
                      className={`w-full h-11 rounded-xl font-semibold ${
                        tier.highlight
                          ? 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white shadow-[0_0_24px_-6px_rgba(139,92,246,0.9)]'
                          : 'bg-transparent border border-[rgba(139,92,246,0.35)] text-white hover:bg-[rgba(139,92,246,0.12)]'
                      }`}
                      size="lg"
                      variant={tier.highlight ? 'default' : 'outline'}
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                  {tier.planId === 'starter' || tier.planId === 'enterprise' ? (
                    <p className="text-[11px] text-center text-[#68668A] mt-3 leading-snug">
                      {tier.planId === 'starter' ? h.landingStarterPlanNote : h.landingEnterprisePlanNote}
                    </p>
                  ) : null}
                </motion.div>
              )
            })}
          </div>
          <p className="mt-10 text-center text-xs text-[#68668A] max-w-xl mx-auto leading-relaxed">
            {h.pricingCallFootnote}
          </p>
        </div>
      </section>

      {/* Stats */}
      <motion.section
        className="py-14 border-y border-[rgba(139,92,246,0.08)] bg-[#0b0b1a]/60"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-6xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { v: h.statsLangValue, l: h.statsLangLabel },
            { v: h.stats247Value, l: h.stats247Label },
            { v: h.statsSpeedValue, l: h.statsSpeedLabel },
            { v: h.statsSetupValue, l: h.statsSetupLabel }
          ].map((s) => (
            <motion.div key={s.l} variants={reveal} className="text-center">
              <p className="text-3xl md:text-4xl font-black text-white font-[family-name:var(--font-brico)]">
                {s.v}
              </p>
              <p className="text-sm text-[#9593A8] mt-1">{s.l}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ */}
      <section className="py-20 px-4" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-white text-center mb-10 font-[family-name:var(--font-brico)]">
            {h.faqTitle}
          </h2>
          <Accordion type="single" collapsible className="space-y-3">
            {h.faq.map(({ q, a }) => (
              <AccordionItem
                key={q}
                value={q}
                className="border border-[rgba(139,92,246,0.12)] rounded-xl px-4 bg-[#121228]"
              >
                <AccordionTrigger className="text-start text-white hover:text-[#A78BFA] hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-[#9593A8] pb-4">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <motion.section
        className="py-24 md:py-32 px-4 relative overflow-hidden"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <motion.span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#8B5CF6]/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 3.5, repeat: Infinity }}
            style={{ width: 'min(90vw, 520px)', height: 'min(90vw, 520px)' }}
          />
          <motion.span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#34D399]/20"
            animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.45, 0.25] }}
            transition={{ duration: 4.2, repeat: Infinity, delay: 0.4 }}
            style={{ width: 'min(95vw, 640px)', height: 'min(95vw, 640px)' }}
          />
        </div>
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-[1.75rem] md:text-5xl font-bold text-white mb-8 font-[family-name:var(--font-brico)] leading-tight">
            {h.finalCtaTitle}
          </h2>
          <Link href={SETUP_NEW_BUSINESS_PATH}>
            <Button className="h-14 px-10 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-lg font-semibold shadow-[0_0_40px_-6px_rgba(139,92,246,0.85)]">
              {h.getStartedFree}
            </Button>
          </Link>
          <p className="mt-4 text-xs text-[#68668A]">{h.finalCtaRings}</p>
        </div>
      </motion.section>

      {/* Footer */}
      <footer
        className="border-t border-[rgba(139,92,246,0.12)] py-14 px-4 bg-[#06060f] pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <HeaderLogo variant="light" />
            <p className="mt-4 text-sm text-[#68668A] leading-relaxed">{h.footerTagline}</p>
            <div className="mt-4">
              <SocialMediaLinks />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#68668A] mb-3">{h.footerProduct}</p>
            <ul className="space-y-2 text-sm text-[#9593A8]">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  {h.navFeatures}
                </a>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  {h.navPricing}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#68668A] mb-3">{h.footerCompany}</p>
            <ul className="space-y-2 text-sm text-[#9593A8]">
              <li>
                <Link href={SETUP_NEW_BUSINESS_PATH} className="hover:text-white transition-colors">
                  {h.footerBookDemo}
                </Link>
              </li>
              <li>
                <a href={`mailto:${h.footerSupportEmail}`} className="hover:text-white transition-colors">
                  {h.footerSupportLabel}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#68668A] mb-3">{h.footerLegal}</p>
            <ul className="space-y-2 text-sm text-[#9593A8]">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  {h.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  {h.termsNav}
                </Link>
              </li>
            </ul>
            <p className="text-xs font-bold uppercase tracking-wider text-[#68668A] mb-3 mt-6">{h.footerConnect}</p>
            <p className="text-sm text-[#9593A8]">{h.footerQuestions}</p>
            <a href={`mailto:${h.footerSupportEmail}`} className="text-sm text-[#A78BFA] hover:underline">
              {h.footerSupportEmail}
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-6xl mt-12 pt-8 border-t border-[rgba(139,92,246,0.08)] text-center text-xs text-[#68668A]">
          {trFormat(h.footerCopyright, { year: String(new Date().getFullYear()) })} · {t.poweredBy}
        </div>
      </footer>
    </main>
  )
}
