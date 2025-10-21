"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Calendar, RotateCcw, XCircle, Bell } from 'lucide-react'

export default function AnalyticsDashboard({ token }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('7d')

  // fetchAnalytics is defined below and doesn't change between renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (token) {
      fetchAnalytics()
    }
  }, [token, range])

  async function fetchAnalytics() {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/analytics/summary?range=${range}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch analytics')
      }
      
      setAnalytics(data)
    } catch (err) {
      console.error('[analytics] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading analytics: {error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!analytics) {
    return null
  }

  const kpis = analytics.kpis || {}
  const series = analytics.series || []

  // KPI Cards Configuration
  const kpiCards = [
    {
      title: 'Total Bookings',
      value: kpis.bookings || 0,
      icon: Calendar,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Reschedules',
      value: kpis.reschedules || 0,
      icon: RotateCcw,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Cancellations',
      value: kpis.cancellations || 0,
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      title: 'Reminders Sent',
      value: kpis.reminders_sent || 0,
      icon: Bell,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    }
  ]

  // Format data for charts
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
          <button
            onClick={() => setRange('7d')}
            className={`px-3 py-1 rounded text-sm ${
              range === '7d' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setRange('30d')}
            className={`px-3 py-1 rounded text-sm ${
              range === '30d' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon
          return (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <div className={`p-2 rounded-full ${kpi.bgColor}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
                {kpi.title === 'Total Bookings' && kpis.avg_lead_time_minutes > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg lead time: {Math.round(kpis.avg_lead_time_minutes / 60)}h {kpis.avg_lead_time_minutes % 60}m
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bookings & Reminders Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bookings & Reminders Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis 
                className="text-xs"
                stroke="currentColor"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="bookings" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Bookings"
              />
              <Line 
                type="monotone" 
                dataKey="reminders" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Reminders"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Reschedules & Cancellations Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Changes & Cancellations</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis 
                className="text-xs"
                stroke="currentColor"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar 
                dataKey="reschedules" 
                fill="#a855f7" 
                name="Reschedules"
              />
              <Bar 
                dataKey="cancellations" 
                fill="#ef4444" 
                name="Cancellations"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Query Performance */}
      {analytics.meta && (
        <div className="text-xs text-muted-foreground text-right">
          Query time: {analytics.meta.query_time_ms}ms
        </div>
      )}
    </div>
  )
}
