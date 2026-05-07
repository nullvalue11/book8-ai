'use client'

import { cn } from '@/lib/utils'

const VOICES = [
  {
    lang: 'en',
    name: 'Michael',
    flag: '🇬🇧',
    desc: 'Warm, professional'
  },
  {
    lang: 'fr',
    name: 'Camille',
    flag: '🇫🇷',
    desc: 'Clear, friendly'
  },
  {
    lang: 'es',
    name: 'Sofia',
    flag: '🇪🇸',
    desc: 'Warm, professional'
  },
  {
    lang: 'ar',
    name: 'Yusuf',
    flag: '🇸🇦',
    desc: 'Formal, friendly'
  }
]

export default function VoicePicker({ value, onChange, defaultLang = 'en' }) {
  const selected = value || defaultLang || 'en'
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {VOICES.map((v) => {
        const active = v.lang === selected
        return (
          <button
            key={v.lang}
            type="button"
            onClick={() => onChange?.(v.lang)}
            className={cn(
              'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
              active
                ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/10'
                : 'border-white/10 bg-[#0A0A0F] hover:border-white/20'
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>
                    {v.flag}
                  </span>
                  <span className="font-semibold text-white">{v.name}</span>
                </div>
                <p className="mt-1 text-sm text-[#94A3B8]">{v.desc}</p>
              </div>
              <span
                className={cn(
                  'h-4 w-4 rounded-full border shrink-0',
                  active ? 'border-[#8B5CF6] bg-[#8B5CF6]' : 'border-white/30 bg-transparent'
                )}
                aria-hidden
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

