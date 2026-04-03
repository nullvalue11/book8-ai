'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { normalizeBookingLanguage, clientPreferredBookingLanguage } from '@/lib/bookingLanguage'
import { BOOKING_LANG_STORAGE_KEY, getBookingTranslations } from '@/lib/translations'

export function readInitialBookingLanguage() {
  if (typeof window === 'undefined') return 'en'
  const params = new URLSearchParams(window.location.search)
  const q = params.get('lang')
  if (q) return normalizeBookingLanguage(q)
  try {
    const stored = localStorage.getItem(BOOKING_LANG_STORAGE_KEY)
    if (stored) return normalizeBookingLanguage(stored)
  } catch {
    /* ignore */
  }
  const fromNav = clientPreferredBookingLanguage()
  return normalizeBookingLanguage(fromNav || 'en')
}

const SiteLanguageContext = createContext(null)

export function SiteLanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en')

  useEffect(() => {
    setLanguageState(readInitialBookingLanguage())
  }, [])

  const setLanguage = useCallback((raw) => {
    const next = normalizeBookingLanguage(raw)
    setLanguageState(next)
    try {
      localStorage.setItem(BOOKING_LANG_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('lang', next)
      window.history.replaceState({}, '', url)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useMemo(() => getBookingTranslations(language), [language])
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <SiteLanguageContext.Provider value={value}>{children}</SiteLanguageContext.Provider>
}

export function useBookingLanguage() {
  const ctx = useContext(SiteLanguageContext)
  if (!ctx) {
    throw new Error('useBookingLanguage must be used within SiteLanguageProvider')
  }
  return ctx
}
