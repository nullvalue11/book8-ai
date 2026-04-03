'use client'

import { useCallback, useEffect, useState } from 'react'
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

export function useBookingLanguage() {
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

  const t = getBookingTranslations(language)
  return { language, setLanguage, t }
}
