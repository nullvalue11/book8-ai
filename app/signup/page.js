'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const PROFILE_STORAGE_KEY = 'book8.wizard.profileFromCreate'

function SignupBridge() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const raw = searchParams.get('profileData')
    if (raw && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(PROFILE_STORAGE_KEY, raw)
      } catch (e) {
        console.warn('[signup] could not persist profileData', e?.message || e)
      }
    }
    const qs = raw ? '?profileSource=wizard' : ''
    router.replace(`/setup${qs}`)
  }, [router, searchParams])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0A0A0F] px-4">
      <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" aria-hidden />
      <p className="mt-4 text-center text-sm text-[#94A3B8]">Taking you to sign up…</p>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#0A0A0F]">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" aria-hidden />
        </main>
      }
    >
      <SignupBridge />
    </Suspense>
  )
}
