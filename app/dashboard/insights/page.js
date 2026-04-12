'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, LineChart } from 'lucide-react'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatMoney } from '@/lib/formatCurrency'
import { BlurProvider } from './BlurContext'
import StatCard, { InsightsHeaderActions } from './StatCard'
import TrendChart from './TrendChart'
import ServiceBreakdown from './ServiceBreakdown'
import HourHeatmap from './HourHeatmap'

const MONTHLY_EMAIL_KEY = 'book8.insights.monthlyEmailOptIn'

function deltaArrow(cur, prev) {
  if (prev === 0) return cur > 0 ? '↑' : '—'
  if (cur > prev) return '↑'
  if (cur < prev) return '↓'
  return '→'
}

function languageSummaryFootnote(breakdown) {
  if (!breakdown || typeof breakdown !== 'object') return null
  const rows = Object.entries(breakdown)
    .map(([code, n]) => ({ code, n: Number(n) || 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
  if (!rows.length) return null
  return rows.map((r) => `${r.code}: ${r.n}`).join(' · ')
}

function InsightsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessIdFromUrl = searchParams.get('businessId')

  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [chartRange, setChartRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [monthlyEmail, setMonthlyEmail] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('book8_token')
    setToken(t)
    if (!t) router.replace('/')
    try {
      setMonthlyEmail(localStorage.getItem(MONTHLY_EMAIL_KEY) === 'true')
    } catch {
      /* ignore */
    }
  }, [router])

  const loadBusinesses = useCallback(async () => {
    if (!token) return
    setLoadError('')
    try {
      const res = await fetch('/api/business/register', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load businesses')
      const list = Array.isArray(data.businesses) ? data.businesses : []
      setBusinesses(list)
      if (list.length) {
        setSelectedBusinessId((prev) =>
          prev && list.some((b) => b.businessId === prev) ? prev : list[0].businessId
        )
      }
    } catch (e) {
      setLoadError(e.message || 'Load failed')
    }
  }, [token])

  useEffect(() => {
    if (token) loadBusinesses()
  }, [token, loadBusinesses])

  useEffect(() => {
    if (!businessIdFromUrl || !businesses.length) return
    if (businesses.some((b) => b.businessId === businessIdFromUrl)) {
      setSelectedBusinessId(businessIdFromUrl)
    }
  }, [businessIdFromUrl, businesses])

  useEffect(() => {
    if (!selectedBusinessId) return
    if (businessIdFromUrl === selectedBusinessId) return
    router.replace(`/dashboard/insights?businessId=${encodeURIComponent(selectedBusinessId)}`, {
      scroll: false
    })
  }, [selectedBusinessId, businessIdFromUrl, router])

  const fetchInsights = useCallback(async () => {
    if (!token || !selectedBusinessId) return
    setLoading(true)
    setLoadError('')
    try {
      const u = new URL(
        `/api/businesses/${encodeURIComponent(selectedBusinessId)}/insights`,
        window.location.origin
      )
      u.searchParams.set('range', chartRange)
      const biz = businesses.find((b) => b.businessId === selectedBusinessId)
      const tz = (biz?.timezone && String(biz.timezone).trim()) || ''
      if (tz) u.searchParams.set('tz', tz)
      const res = await fetch(u.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load insights')
      setPayload(data)
    } catch (e) {
      setPayload(null)
      setLoadError(e.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [token, selectedBusinessId, chartRange, businesses])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const currency = payload?.currency || 'CAD'
  const summary = payload?.summary
  const meta = payload?.meta || {}
  const businessTimezone = payload?.businessTimezone || 'America/Toronto'

  const setMonthlyEmailPref = (on) => {
    setMonthlyEmail(on)
    try {
      localStorage.setItem(MONTHLY_EMAIL_KEY, String(on))
    } catch {
      /* ignore */
    }
  }

  const bookingsDelta = useMemo(() => {
    if (!summary) return { sub: '' }
    const cur = summary.bookingsThisMonth
    const prev = summary.bookingsLastMonth
    const arrow = deltaArrow(cur, prev)
    return { sub: `${arrow} from ${prev} last mo` }
  }, [summary])

  const revenueDelta = useMemo(() => {
    if (!summary) return { sub: '' }
    const cur = summary.revenueThisMonth
    const prev = summary.revenueLastMonth
    const arrow = deltaArrow(cur, prev)
    return { sub: `${arrow} from ${formatMoney(prev, currency)} last mo` }
  }, [summary, currency])

  const langFoot = useMemo(
    () => languageSummaryFootnote(summary?.languageBreakdown),
    [summary]
  )

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LineChart className="h-7 w-7" />
              Revenue insights
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Completed bookings and calls in your business timezone ({businessTimezone}). Press{' '}
              <kbd className="px-1 rounded border bg-muted text-xs">B</kbd> to hide amounts.
            </p>
          </div>
          <InsightsHeaderActions />
        </div>

        {loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : null}

        {businesses.length > 1 ? (
          <div className="max-w-md space-y-2">
            <Label>Business</Label>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger>
                <SelectValue placeholder="Select business" />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.businessId} value={b.businessId}>
                    {b.name || b.businessId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {meta.noBookingsEver ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
            When you start taking bookings, you&apos;ll see revenue, languages, and call patterns here.
          </p>
        ) : null}
        {meta.upcomingOnly ? (
          <p className="text-sm text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            Insights use completed visits only. Your upcoming appointments will appear after they pass.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Bookings (this month)"
            primary={summary != null ? String(summary.bookingsThisMonth) : '—'}
            subtitle={summary ? bookingsDelta.sub : null}
          />
          <StatCard
            title="Revenue (this month)"
            primary={summary != null ? formatMoney(summary.revenueThisMonth, currency) : '—'}
            subtitle={summary ? revenueDelta.sub : null}
            isMoney
            currency={currency}
            amountForBlur={summary != null ? summary.revenueThisMonth : null}
          />
          <StatCard
            title="Calls handled (this month)"
            primary={summary != null ? String(summary.callsHandledThisMonth) : '—'}
            footNote={
              summary != null && summary.callsAfterHours > 0
                ? `${summary.callsAfterHours} after hours`
                : null
            }
          />
          <StatCard
            title="Languages (this month)"
            primary={
              summary?.languagesUsed?.length
                ? `${summary.languagesUsed.length} active`
                : summary
                  ? '—'
                  : '—'
            }
            footNote={langFoot}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Trend</CardTitle>
              <CardDescription>Daily completed bookings and revenue</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="insights-range" className="text-muted-foreground whitespace-nowrap">
                Range
              </Label>
              <Select value={chartRange} onValueChange={setChartRange}>
                <SelectTrigger id="insights-range" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !payload ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !meta.trendEligible ? (
              <p className="text-sm text-muted-foreground py-8">
                The chart appears once you have completed bookings and at least seven days of history.
              </p>
            ) : (
              <TrendChart
                trend={payload?.trend}
                currency={currency}
                businessTimezone={businessTimezone}
              />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top services</CardTitle>
              <CardDescription>This month · revenue where pricing is set</CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceBreakdown topServices={payload?.topServices} currency={currency} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Call heatmap</CardTitle>
              <CardDescription>Weekday × hour (6:00–22:00, business timezone)</CardDescription>
            </CardHeader>
            <CardContent>
              {!meta.heatmapEligible ? (
                <p className="text-sm text-muted-foreground py-6">
                  Need at least 14 days of call history to show patterns.
                </p>
              ) : (
                <HourHeatmap cells={payload?.hourHeatmap} />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly summary email</CardTitle>
            <CardDescription>
              Preference is stored on this device only for now (no account sync).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch
              id="insights-monthly-email"
              checked={monthlyEmail}
              onCheckedChange={setMonthlyEmailPref}
            />
            <Label htmlFor="insights-monthly-email" className="cursor-pointer">
              Email me a short monthly recap
            </Label>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function InsightsPage() {
  return (
    <BlurProvider>
      <Suspense
        fallback={
          <main className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </main>
        }
      >
        <InsightsContent />
      </Suspense>
    </BlurProvider>
  )
}
