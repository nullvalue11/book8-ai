'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Header from '@/components/Header'
import { Activity, Loader2, RefreshCw, ArrowLeft } from 'lucide-react'

function normalizeCheck(check) {
  if (check == null) return { ok: false, detail: '—' }
  if (typeof check === 'boolean') return { ok: check, detail: check ? 'OK' : 'No' }
  if (typeof check === 'object' && 'ok' in check) {
    return { ok: !!check.ok, detail: check.detail != null ? String(check.detail) : String(check.ok) }
  }
  return { ok: false, detail: String(check) }
}

function StatusDot({ ok }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-2 shrink-0 ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
      aria-hidden
    />
  )
}

function CheckRow({ label, check }) {
  const n = normalizeCheck(check)
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-4 border-b border-border last:border-0">
      <div className="flex items-center min-w-0">
        <StatusDot ok={n.ok} />
        <span className="font-medium text-foreground capitalize">{label.replace(/_/g, ' ')}</span>
      </div>
      <span className="text-sm text-muted-foreground text-right break-all max-w-[55%]">{n.detail}</span>
    </div>
  )
}

function ProvisioningContent() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('book8_token')
    setToken(t)
    if (!t) router.replace('/')
  }, [router])

  const fetchStatus = async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch('/api/admin/provisioning-status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok && res.status === 401) {
        router.replace('/')
        return
      }
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) fetchStatus()
  }, [token])

  const handleRetry = async () => {
    if (!status?.businessId || !token) return
    try {
      setRetrying(true)
      await fetch('/api/admin/provisioning-retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: status.businessId, steps: [] })
      })
      await fetchStatus()
    } catch (err) {
      setError(err.message || 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (loading && !status) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-3xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-2">System status</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking systems…
          </p>
        </div>
      </main>
    )
  }

  if (error && !status) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-3xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-2">System status</h1>
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchStatus}>Try again</Button>
        </div>
      </main>
    )
  }

  if (!status) return null

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-7 w-7" />
              System status
            </h1>
            {status.businessName && status.businessId ? (
              <p className="text-muted-foreground text-sm mt-1">
                {status.businessName} — {status.businessId}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm mt-1">{status.message || 'No business yet'}</p>
            )}
          </div>
          {status.overallStatus && (
            <span
              className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                status.ok
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              {status.overallStatus}
            </span>
          )}
        </div>

        {status.status === 'NO_BUSINESS' ? (
          <Card>
            <CardHeader>
              <CardTitle>No business yet</CardTitle>
              <CardDescription>
                Create a business first, then return here to verify dashboard and core-api sync.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/business">Set up business</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-violet-600 dark:text-violet-400">
                  Dashboard (this app)
                </CardTitle>
                <CardDescription>Data stored in your Book8 AI account</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {status.dashboardChecks &&
                  Object.entries(status.dashboardChecks).map(([key, check]) => (
                    <CheckRow key={key} label={key} check={check} />
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-sky-600 dark:text-sky-400">
                  Core API
                </CardTitle>
                <CardDescription className="flex items-center justify-between gap-2">
                  <span>Phone, SMS, and booking engine</span>
                  <span className="text-xs">
                    {status.coreApi?.reachable ? 'Reached' : 'Unreachable'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!status.coreApi?.reachable ? (
                  <div className="p-4 text-sm text-destructive">
                    {status.coreApi?.message || 'Could not load core-api health.'}
                  </div>
                ) : status.coreApi?.checks && typeof status.coreApi.checks === 'object' ? (
                  Object.entries(status.coreApi.checks).map(([key, check]) => (
                    <CheckRow key={key} label={key} check={check} />
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    {status.coreApi?.status} — {status.coreApi?.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {!status.ok && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleRetry} disabled={retrying}>
                  {retrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Retrying…
                    </>
                  ) : (
                    'Retry provisioning (core-api)'
                  )}
                </Button>
                <Button variant="outline" onClick={fetchStatus} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            )}

            {status.ok && (
              <Button variant="outline" onClick={fetchStatus} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </>
        )}

        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 text-sm text-muted-foreground">
          <p className="m-0">
            <strong className="text-violet-600 dark:text-violet-400">How it works:</strong> Checkout creates
            your business here, then provisioning mirrors it to the core API (calls, SMS, web bookings). Both
            sides should show green. If anything is red, use retry or check core-api deployment and secrets.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function ProvisioningPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      }
    >
      <ProvisioningContent />
    </Suspense>
  )
}
