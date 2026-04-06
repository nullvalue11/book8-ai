'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import MultiLocationOverview from '@/components/dashboard/MultiLocationOverview'
import { resolveBusinessPlanKey } from '@/lib/subscription'

export default function MultiLocationDashboardPage() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('book8_token')
    setToken(t)
    if (!t) {
      router.replace('/')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${t}` },
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        const list = Array.isArray(data?.businesses) ? data.businesses : []
        const isEnt = list.some((b) => resolveBusinessPlanKey(b) === 'enterprise')
        if (!isEnt || list.length < 2) {
          const first = list[0]
          router.replace(
            first ? `/dashboard?businessId=${encodeURIComponent(first.businessId)}` : '/dashboard'
          )
          return
        }
        setBusinesses(list)
      } catch {
        router.replace('/dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('book8_token')
      localStorage.removeItem('book8_user')
    }
    signOut({ callbackUrl: '/' })
  }

  if (!token || loading || !businesses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return <MultiLocationOverview businesses={businesses} token={token} onLogout={handleLogout} />
}
