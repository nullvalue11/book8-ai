'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGrid, Plus, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HeaderLogo from '@/components/HeaderLogo'
import ThemeToggle from '@/components/ThemeToggle'
import UpgradePrompt from '@/components/UpgradePrompt'
import AggregateStats from './AggregateStats'
import LocationCard from './LocationCard'
import ActivityFeed from './ActivityFeed'
import AggregateCharts from './AggregateCharts'
import {
  normalizeAggregateStats,
  mergeActivityItems,
  normalizeAnalyticsChartData
} from './aggregateNormalize'
import { SETUP_NEW_BUSINESS_PATH } from '@/lib/setup-entry'

async function fetchAggregate(token, path, query = '') {
  const q = query ? (query.startsWith('?') ? query : `?${query}`) : ''
  const res = await fetch(`/api/proxy/businesses/aggregate/${path}${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

export default function MultiLocationOverview({ businesses, token, onLogout }) {
  const router = useRouter()
  const [statsLoading, setStatsLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [statsNorm, setStatsNorm] = useState(() => normalizeAggregateStats(null))
  const [activityItems, setActivityItems] = useState([])
  const [chartData, setChartData] = useState(() => normalizeAnalyticsChartData(null))

  const metricsById = useMemo(() => {
    const m = {}
    for (const row of statsNorm.locationRows) {
      if (row.businessId) m[row.businessId] = row
    }
    return m
  }, [statsNorm.locationRows])

  const loadAll = useCallback(async () => {
    if (!token) return
    setStatsLoading(true)
    setActivityLoading(true)
    setChartsLoading(true)
    setForbidden(false)

    const statsR = await fetchAggregate(token, 'stats')
    if (statsR.res.status === 403) {
      setForbidden(true)
      setStatsNorm(normalizeAggregateStats(null))
      setStatsLoading(false)
      setActivityLoading(false)
      setChartsLoading(false)
      return
    }
    setStatsNorm(normalizeAggregateStats(statsR.data))

    const [bookR, callR, analyticsR] = await Promise.all([
      fetchAggregate(token, 'bookings', 'limit=10&sort=-createdAt'),
      fetchAggregate(token, 'calls', 'limit=10&sort=-createdAt'),
      fetchAggregate(token, 'analytics', 'period=month')
    ])

    if (bookR.res.status === 403 || callR.res.status === 403 || analyticsR.res.status === 403) {
      setForbidden(true)
    }

    setActivityItems(mergeActivityItems(bookR.data, callR.data))
    setChartData(normalizeAnalyticsChartData(analyticsR.data))

    setStatsLoading(false)
    setActivityLoading(false)
    setChartsLoading(false)
  }, [token])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const n = businesses.length

  if (forbidden) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
            <Link href="/" className="flex items-center gap-2">
              <HeaderLogo className="opacity-90" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto max-w-lg px-4 py-16 space-y-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-2xl">
            🏢
          </div>
          <h1 className="text-2xl font-bold text-foreground">Multi-Location Dashboard</h1>
          <p className="text-muted-foreground">
            Manage all your locations from one view. Available on the Enterprise plan.
          </p>
          <UpgradePrompt
            feature="Multi-location dashboard"
            currentPlan="Your plan"
            requiredPlan="Enterprise"
            className="text-left"
          />
          <Button variant="outline" onClick={() => router.push('/dashboard?businessId=' + encodeURIComponent(businesses[0]?.businessId || ''))}>
            Back to location dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <HeaderLogo className="opacity-90 shrink-0" />
            <span className="hidden sm:inline text-sm text-muted-foreground truncate">
              All locations
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link href={SETUP_NEW_BUSINESS_PATH}>+ Add Location</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Sub-nav: match BOO-67B sidebar as horizontal strip */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 px-2 py-1 rounded-md bg-brand-500/10">
            <LayoutGrid className="w-4 h-4" aria-hidden />
            All Locations
          </span>
          {businesses.map((b) => (
            <Link
              key={b.businessId}
              href={`/dashboard?businessId=${encodeURIComponent(b.businessId)}`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/80"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate max-w-[200px]">{b.name?.trim() || b.businessId}</span>
            </Link>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 md:px-6 py-8 space-y-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-brand-500 shrink-0" aria-hidden />
            All Locations
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of your {n} location{n !== 1 ? 's' : ''}
          </p>
        </div>

        <AggregateStats stats={statsNorm} loading={statsLoading} />

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Your locations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {businesses.map((b) => (
              <LocationCard
                key={b.businessId}
                business={b}
                metrics={metricsById[b.businessId] || {}}
                logoUrl={null}
              />
            ))}
          </div>
        </div>

        <ActivityFeed items={activityItems} loading={activityLoading} />

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Analytics</h2>
          <AggregateCharts chartData={chartData} loading={chartsLoading} />
        </div>
      </main>
    </div>
  )
}
