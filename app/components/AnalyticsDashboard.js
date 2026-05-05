"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Calendar, RotateCcw, XCircle, Bell, Lock, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { formatAnalyticsChartDayLabel, DEFAULT_BUSINESS_TIMEZONE } from '@/lib/bookingDisplayTime'
import { pricingPaywallUrl } from '@/lib/pricingPaywallUrl'
import { formatPrice } from '@/lib/currency'

export default function AnalyticsDashboard({
  token,
  subscribed = false,
  planLimits = null,
  onSubscriptionRequired,
  businessTimeZone = DEFAULT_BUSINESS_TIMEZONE,
  businessId = null
}) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('7d')
  const [isSubscriptionError, setIsSubscriptionError] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    if (!token) return
    
    setLoading(true)
    setError(null)
    setIsSubscriptionError(false)
    
    try {
      const res = await fetch(`/api/analytics/summary?range=${range}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      
      if (!res.ok) {
        // Check if it's a subscription error
        if (res.status === 402 || data.code === 'SUBSCRIPTION_REQUIRED' || data.error?.includes('Subscription required')) {
          setIsSubscriptionError(true)
          throw new Error('Subscription required')
        }
        throw new Error(data.error || 'Failed to fetch analytics')
      }
      
      setAnalytics(data)
      setIsSubscriptionError(false)
    } catch (err) {
      console.error('[analytics] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, range])

  // Fetch when token or range changes
  useEffect(() => {
    if (token) fetchAnalytics()
  }, [token, range, fetchAnalytics])
  
  // Re-fetch when subscribed prop changes to true
  useEffect(() => {
    if (subscribed && isSubscriptionError && token) {
      console.log('[analytics] Subscription status changed, re-fetching...')
      fetchAnalytics()
    }
  }, [subscribed, isSubscriptionError, token, fetchAnalytics])

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    // Don't show error if it's just an auth issue - that's expected when not logged in
    if (error.includes('Invalid or expired token') || error.includes('Missing Authorization')) {
      return null
    }
    
    // Show subscription required UI
    if (isSubscriptionError) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Analytics</h2>
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Lock className="w-8 h-8 text-yellow-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800">Analytics requires a subscription</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {subscribed 
                      ? "Your subscription is active. Click refresh to load analytics."
                      : "Subscribe to unlock detailed analytics, booking trends, and conversion metrics."}
                  </p>
                  <div className="mt-4 flex gap-2">
                    {subscribed ? (
                      <Button size="sm" onClick={fetchAnalytics} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Analytics
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          window.location.href = pricingPaywallUrl({
                            businessId,
                            feature: 'analytics'
                          })
                        }}
                      >
                        View Plans
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-destructive">Error loading analytics: {error}</p>
              <Button size="sm" variant="outline" onClick={fetchAnalytics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analytics) return null

  const kpis = analytics.kpis || {}
  const series = analytics.series || []
  const revenueCaptured = analytics.revenueCaptured || null

  const revenueCents = Number(revenueCaptured?.thisMonthCents ?? 0) || 0
  const prevRevenueCents = Number(revenueCaptured?.previousMonthCents ?? 0) || 0
  const revenueCurrency = revenueCaptured?.currency || 'USD'
  const revenueBookingCount = Number(revenueCaptured?.bookingCount ?? 0) || 0
  const pricesConfigured = revenueCaptured?.pricesConfigured !== false
  const showDelta = prevRevenueCents > 0
  const deltaCents = revenueCents - prevRevenueCents
  const deltaUp = deltaCents >= 0
  const deltaIcon = deltaUp ? TrendingUp : TrendingDown

  const hasMeaningfulData =
    (Number(kpis.bookings) || 0) > 0 ||
    (Number(kpis.reschedules) || 0) > 0 ||
    (Number(kpis.cancellations) || 0) > 0 ||
    (Number(kpis.reminders_sent) || 0) > 0 ||
    (Array.isArray(series) &&
      series.some(
        (d) =>
          (Number(d.bookings) || 0) > 0 ||
          (Number(d.reminders_sent) || 0) > 0 ||
          (Number(d.reschedules) || 0) > 0 ||
          (Number(d.cancellations) || 0) > 0
      ))

  if (!hasMeaningfulData) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-6 py-12 text-center text-muted-foreground">
          <p className="font-medium text-foreground">No activity to show yet</p>
          <p className="text-sm mt-2 max-w-md mx-auto">
            Analytics will appear here once you start receiving calls and bookings.
          </p>
          <Button variant="outline" size="sm" className="mt-6" onClick={() => fetchAnalytics()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  const hasAdvancedAnalytics = !planLimits || planLimits.advancedAnalytics !== false

  const kpiCardsAll = [
    { title: 'Total Bookings', value: kpis.bookings || 0, icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { title: 'Reschedules', value: kpis.reschedules || 0, icon: RotateCcw, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { title: 'Cancellations', value: kpis.cancellations || 0, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { title: 'Reminders Sent', value: kpis.reminders_sent || 0, icon: Bell, color: 'text-green-500', bgColor: 'bg-green-500/10' }
  ]

  const kpiCards = hasAdvancedAnalytics
    ? kpiCardsAll
    : kpiCardsAll.filter(card => card.title === 'Total Bookings' || card.title === 'Cancellations')

  const lineChartData = series.map((day) => ({
    date: formatAnalyticsChartDayLabel(day.date, businessTimeZone),
    bookings: day.bookings,
    reminders: day.reminders_sent
  }))

  const barChartData = series.map((day) => ({
    date: formatAnalyticsChartDayLabel(day.date, businessTimeZone),
    reschedules: day.reschedules,
    cancellations: day.cancellations
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <div className="flex gap-2">
          <button onClick={() => setRange('7d')} className={`px-3 py-1 rounded text-sm ${range === '7d' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>7 Days</button>
          <button onClick={() => setRange('30d')} className={`px-3 py-1 rounded text-sm ${range === '30d' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>30 Days</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue captured (prominent, first tile) */}
        {revenueCaptured ? (
          <Card className="overflow-hidden border-brand-500/20 bg-brand-500/5">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue captured this month
                </CardTitle>
                <div className="p-2 rounded-full bg-brand-500/10">
                  <DollarSign className="h-4 w-4 text-brand-500" aria-hidden />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pricesConfigured ? (
                <>
                  <div className="text-3xl font-bold">
                    {formatPrice(revenueCents / 100, revenueCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From {revenueBookingCount.toLocaleString()} booking{revenueBookingCount === 1 ? '' : 's'} captured this month
                  </p>
                  {showDelta ? (
                    <p className={`mt-2 text-xs font-medium flex items-center gap-1 ${deltaUp ? 'text-emerald-600' : 'text-amber-700'}`}>
                      {React.createElement(deltaIcon, { className: 'h-3.5 w-3.5', 'aria-hidden': true })}
                      {formatPrice(Math.abs(deltaCents) / 100, revenueCurrency)} vs last month
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Set up service prices to see recovered revenue
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = '/dashboard/services'
                    }}
                  >
                    Configure services →
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <div className={`p-2 rounded-full ${kpi.bgColor}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
                {kpi.title === 'Total Bookings' && kpis.avg_lead_time_minutes > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Avg lead time: {Math.round(kpis.avg_lead_time_minutes / 60)}h {kpis.avg_lead_time_minutes % 60}m</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {hasAdvancedAnalytics ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bookings &amp; Reminders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" stroke="currentColor" />
                  <YAxis className="text-xs" stroke="currentColor" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Line type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} name="Bookings" />
                  <Line type="monotone" dataKey="reminders" stroke="#10b981" strokeWidth={2} name="Reminders" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Changes &amp; Cancellations</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" stroke="currentColor" />
                  <YAxis className="text-xs" stroke="currentColor" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="reschedules" fill="#a855f7" name="Reschedules" />
                  <Bar dataKey="cancellations" fill="#ef4444" name="Cancellations" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-border bg-muted/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Advanced analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Advanced analytics (trends, charts, and detailed breakdowns) are available on the Growth plan.
            </p>
            <Button
              size="sm"
              onClick={() => {
                window.location.href = pricingPaywallUrl({
                  businessId,
                  feature: 'analytics'
                })
              }}
            >
              Upgrade to Growth
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
