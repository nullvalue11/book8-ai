'use client'

import { useBookingLanguage } from '@/hooks/useBookingLanguage'

export default function SkipToMainLink() {
  const { t } = useBookingLanguage()
  return (
    <a
      href="#main-content"
      className="absolute start-0 top-0 z-[100] -translate-y-full overflow-hidden p-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-br-md shadow-md focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {t.skipToMain}
    </a>
  )
}
