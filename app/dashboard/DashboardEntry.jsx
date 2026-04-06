'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Home from '../page'
import { resolveBusinessPlanKey } from '@/lib/subscription'

function DashboardEntryInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId')
  const [ready, setReady] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('book8_token') : null
        if (!token) {
          if (!cancelled) setReady(true)
          return
        }
        const res = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        const list = Array.isArray(data?.businesses) ? data.businesses : []
        const isEnt = list.some((b) => resolveBusinessPlanKey(b) === 'enterprise')
        if (isEnt && list.length >= 2 && !businessId) {
          setRedirecting(true)
          router.replace('/dashboard/locations')
          return
        }
      } catch {
        /* single-location dashboard */
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router, businessId])

  if (!ready || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <Home forceDashboard />
}

export default function DashboardEntry() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <DashboardEntryInner />
    </Suspense>
  )
}
