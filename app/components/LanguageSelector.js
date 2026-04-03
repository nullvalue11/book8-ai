'use client'

import { normalizeBookingLanguage } from '@/lib/bookingLanguage'

const FLAGS = { en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', ar: '🇸🇦' }

/** @param {{ value: string, onChange: (lang: string) => void, t: import('@/lib/translations').BookingTranslations, className?: string, variant?: 'dark' | 'light' }} props */
export default function LanguageSelector({ value, onChange, t, className = '', variant = 'dark' }) {
  const v = normalizeBookingLanguage(value)
  const base =
    variant === 'light'
      ? 'rounded-lg border border-border bg-background text-sm text-foreground px-2.5 py-2 focus:ring-brand-500'
      : 'rounded-lg border border-gray-700 bg-gray-900 text-sm text-white px-2.5 py-2 focus:ring-violet-500'
  return (
    <select
      id="booking-language"
      aria-label={t.lngAria}
      value={v}
      onChange={(e) => onChange(normalizeBookingLanguage(e.target.value))}
      className={[
        base,
        'focus:outline-none focus:ring-2 cursor-pointer max-w-[11rem] sm:max-w-none',
        className
      ].join(' ')}
    >
      <option value="en">{FLAGS.en} {t.lngEnglish}</option>
      <option value="fr">{FLAGS.fr} {t.lngFrench}</option>
      <option value="es">{FLAGS.es} {t.lngSpanish}</option>
      <option value="ar">{FLAGS.ar} {t.lngArabic}</option>
    </select>
  )
}
