'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, Zap, Package, Building2 } from 'lucide-react'

function UpgradeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get('businessId') || ''
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(/** @type {null | 'starter' | 'growth' | 'enterprise'} */ (null))
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      setToken(localStorage.getItem('book8_token'))
    } catch {
      setToken(null)
    }
  }, [])

  const startCheckout = useCallback(
    async (priceEnvKey) => {
      if (!token) {
        router.push('/?showAuth=1')
        return
      }
      const tierMap = { PRICE_STARTER: 'starter', PRICE_GROWTH: 'growth', PRICE_ENTERPRISE: 'enterprise' }
      const tier = tierMap[priceEnvKey]
      setError('')
      setLoading(tier || null)
      try {
        const pr = await fetch('/api/billing/plans', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const prices = await pr.json().catch(() => ({}))
        const priceId = tier ? prices?.plans?.[tier] : null
        if (!priceId) {
          setError('Billing is not configured. Contact support.')
          setLoading(null)
          return
        }
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            priceId,
            businessId: businessId || undefined,
            returnTo: 'upgrade'
          })
        })
        const data = await res.json()
        if (data.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl
          return
        }
        setError(data.error || 'Could not start checkout')
      } catch (e) {
        setError(e?.message || 'Checkout failed')
      } finally {
        setLoading(null)
      }
    },
    [token, businessId, router]
  )

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose a plan</h1>
          <p className="text-muted-foreground mt-2">
            Upgrade to unlock the dashboard and AI phone features. Prices in USD / month.
          </p>
          {businessId ? (
            <p className="text-xs text-muted-foreground mt-2">Business: {businessId}</p>
          ) : null}
        </div>

        {error ? (
          <p className="text-center text-destructive text-sm mb-4" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-cyan-500" />
                Starter
              </CardTitle>
              <p className="text-3xl font-bold">$29</p>
              <p className="text-sm text-muted-foreground">per month</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-2">
                {['Calendar sync & booking page', 'Email reminders', 'Essential analytics'].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant="outline"
                disabled={loading !== null}
                onClick={() => startCheckout('PRICE_STARTER')}
              >
                {loading === 'starter' ? 'Redirecting…' : 'Upgrade to Starter'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50 shadow-md md:scale-[1.02]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-primary" />
                Growth
              </CardTitle>
              <p className="text-3xl font-bold">$99</p>
              <p className="text-sm text-muted-foreground">per month</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-2">
                {[
                  'Everything in Starter',
                  'AI receptionist · 70+ languages',
                  'SMS & review requests',
                  'Up to 5 businesses'
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button className="w-full" disabled={loading !== null} onClick={() => startCheckout('PRICE_GROWTH')}>
                {loading === 'growth' ? 'Redirecting…' : 'Upgrade to Growth'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-amber-500" />
                Enterprise
              </CardTitle>
              <p className="text-3xl font-bold">$299</p>
              <p className="text-sm text-muted-foreground">per month · per location</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-2">
                {['Everything in Growth', 'Multi-location dashboard', 'Priority support & SLA'].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant="outline"
                disabled={loading !== null}
                onClick={() => startCheckout('PRICE_ENTERPRISE')}
              >
                {loading === 'enterprise' ? 'Redirecting…' : 'Upgrade to Enterprise'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center mt-8 text-sm text-muted-foreground">
          <Link href="/" className="underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background p-6 text-muted-foreground">
          Loading…
        </main>
      }
    >
      <UpgradeContent />
    </Suspense>
  )
}
