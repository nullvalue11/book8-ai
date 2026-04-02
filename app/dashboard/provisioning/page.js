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
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <span className="text-sm text-muted-foreground text-right break-all max-w-[55%]">{n.detail}</span>
    </div>
  )
}

/** Customer-facing labels for dashboard (Mongo) checks */
const DASHBOARD_LABELS = {
  business_record: 'Business Status',
  subscription: 'Subscription',
  calendar_connection: 'Calendar',
  handle: 'Public booking page',
  timezone: 'Timezone'
}

/** Map core health check keys → customer labels; omit infra (ElevenLabs, webhooks, duplicate calendar). */
const BOOKING_ENGINE_LABELS = {
  business_record: 'Business Status',
  businessrecord: 'Business Status',
  services: 'Services',
  service: 'Services',
  schedule: 'Business Hours',
  weekly_hours: 'Business Hours',
  weeklyhours: 'Business Hours',
  business_hours: 'Business Hours',
  phone: 'Phone Number',
  phone_number: 'Phone Number',
  phonenumber: 'Phone Number',
  twilio: 'Phone Number',
  assigned_number: 'Phone Number'
}

function dashboardLabel(key) {
  return DASHBOARD_LABELS[key] || String(key).replace(/_/g, ' ')
}

function bookingEngineLabel(rawKey) {
  const key = String(rawKey || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
  if (/elevenlabs|webhook|calendar/.test(key)) return null
  if (BOOKING_ENGINE_LABELS[key]) return BOOKING_ENGINE_LABELS[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function filterCoreChecks(checks) {
  if (!checks || typeof checks !== 'object') return []
  return Object.entries(checks).filter(([k]) => bookingEngineLabel(k))
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
            {status.businessName ? (
              <p className="text-muted-foreground text-sm mt-1">{status.businessName}</p>
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
                  Your account
                </CardTitle>
                <CardDescription>Settings and records stored in Book8-AI</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {status.dashboardChecks &&
                  Object.entries(status.dashboardChecks).map(([key, check]) => (
                    <CheckRow key={key} label={dashboardLabel(key)} check={check} />
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-sky-600 dark:text-sky-400">
                  Booking engine
                </CardTitle>
                <CardDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>Your phone line, services, and hours for bookings</span>
                  <span className="text-xs text-muted-foreground">
                    {status.coreApi?.reachable ? 'Online' : 'Unavailable'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!status.coreApi?.reachable ? (
                  <div className="p-4 text-sm text-destructive">
                    {status.coreApi?.message || 'Booking engine could not be reached.'}
                  </div>
                ) : (() => {
                    const rows = filterCoreChecks(status.coreApi.checks)
                    if (rows.length > 0) {
                      return rows.map(([key, check]) => (
                        <CheckRow key={key} label={bookingEngineLabel(key)} check={check} />
                      ))
                    }
                    return (
                      <div className="p-4 text-sm text-muted-foreground">
                        {status.coreApi?.status} — {status.coreApi?.message}
                      </div>
                    )
                  })()}
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
                    'Retry provisioning'
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
            <strong className="text-violet-600 dark:text-violet-400">How it works:</strong> This page summarizes
            your business profile, subscription, calendar, public booking link, and booking engine status. Green
            means things look good. If something needs attention, try <strong>Refresh</strong> or{' '}
            <strong>Retry provisioning</strong>, or contact support.
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
