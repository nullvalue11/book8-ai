'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * BOO-98B: After Stripe Checkout, poll trial-status until subscribed then return home.
 */
function UpgradeSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId') || ''
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('Confirming your subscription…')

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('book8_token') : null
    if (!token || !businessId) {
      setStatus('error')
      setMessage('Missing session. Return to upgrade and try again.')
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 40

    const tick = async () => {
      if (cancelled) return
      attempts += 1
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/trial-status`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await res.json().catch(() => ({}))
        if (data.ok && data.status === 'subscribed') {
          setStatus('done')
          setMessage('You are subscribed. Redirecting…')
          router.replace('/')
          return
        }
      } catch {
        /* continue polling */
      }
      if (attempts >= maxAttempts) {
        setStatus('timeout')
        setMessage('Subscription is still processing. Open the dashboard in a moment or use “Sync” if you already paid.')
        return
      }
      setTimeout(tick, 1500)
    }

    void tick()
    return () => {
      cancelled = true
    }
  }, [businessId, router])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground mb-2">Payment complete</h1>
      <p className="text-muted-foreground text-sm max-w-md mb-6">{message}</p>
      {status === 'timeout' || status === 'error' ? (
        <Link href="/" className="text-primary underline text-sm">
          Go to dashboard
        </Link>
      ) : (
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
      )}
    </main>
  )
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background p-6 text-muted-foreground">
          Loading…
        </main>
      }
    >
      <UpgradeSuccessContent />
    </Suspense>
  )
}
