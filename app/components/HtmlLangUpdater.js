'use client'

import { useEffect } from 'react'
import { useBookingLanguage } from '@/hooks/useBookingLanguage'

/** Syncs <html lang> and dir with site language (SPA navigation does not reload the document). */
export default function HtmlLangUpdater() {
  const { language } = useBookingLanguage()

  useEffect(() => {
    const html = document.documentElement
    const langMap = { en: 'en', fr: 'fr', es: 'es', ar: 'ar' }
    html.lang = langMap[language] || 'en'
    html.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  return null
}
