"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, RotateCcw, XCircle, Bell, Lock, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

export default function AnalyticsDashboard({ token, subscribed = false, onSubscriptionRequired }) {
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
                      <Button size="sm" onClick={() => window.location.href = '/pricing?paywall=1&feature=analytics'}>
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

  const kpiCards = [
    { title: 'Total Bookings', value: kpis.bookings || 0, icon: Calendar, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { title: 'Reschedules', value: kpis.reschedules || 0, icon: RotateCcw, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { title: 'Cancellations', value: kpis.cancellations || 0, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { title: 'Reminders Sent', value: kpis.reminders_sent || 0, icon: Bell, color: 'text-green-500', bgColor: 'bg-green-500/10' }
  ]

  const lineChartData = series.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    bookings: day.bookings,
    reminders: day.reminders_sent
  }))

  const barChartData = series.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bookings & Reminders Trend</CardTitle>
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
          <CardTitle className="text-lg">Changes & Cancellations</CardTitle>
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

      {analytics.meta && (
        <div className="text-xs text-muted-foreground text-right">Query time: {analytics.meta.query_time_ms}ms</div>
      )}
    </div>
  )
}
