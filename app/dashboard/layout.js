'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SETUP_NEW_BUSINESS_PATH } from '@/lib/setup-entry'

/**
 * BOO-47B: Users with no businesses (local DB) always go to /setup first.
 * Runs once per dashboard subtree visit; /setup is outside this layout (no redirect loop).
 */
export default function DashboardLayout({ children }) {
  const router = useRouter()
  const [appReady, setAppReady] = useState(false)
  const [token, setToken] = useState(null)
  /** When user is logged in, false until business list check finishes (or redirect to setup). */
  const [allowShell, setAllowShell] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        setToken(localStorage.getItem('book8_token'))
      }
    } finally {
      setAppReady(true)
    }
  }, [])

  useEffect(() => {
    if (!appReady) return

    if (!token) {
      setAllowShell(true)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        const list = Array.isArray(data?.businesses) ? data.businesses : []
        if (data?.ok && list.length === 0) {
          router.replace(SETUP_NEW_BUSINESS_PATH)
          return
        }
      } catch {
        /* same as Home fetchPhoneSetupStatus: allow dashboard if request fails */
      }

      if (!cancelled) setAllowShell(true)
    })()

    return () => {
      cancelled = true
    }
  }, [appReady, token, router])

  if (!appReady || (token && !allowShell)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return children
}
