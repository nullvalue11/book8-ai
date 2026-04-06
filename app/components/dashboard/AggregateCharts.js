'use client'

import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const accent = ['#7C4DFF', '#34D399', '#F472B6', '#38BDF8', '#FBBF24', '#A78BFA']

export default function AggregateCharts({ chartData, loading }) {
  const trendKeys = useMemo(() => {
    const rows = chartData.bookingsTrend || []
    if (!rows.length) return []
    const keys = new Set()
    for (const row of rows) {
      Object.keys(row).forEach((k) => {
        if (k !== 'date' && k !== 'total' && typeof row[k] === 'number') keys.add(k)
      })
    }
    return [...keys].slice(0, 5)
  }, [chartData.bookingsTrend])

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border/80 animate-pulse h-80 bg-card/50" />
        ))}
      </div>
    )
  }

  const trend = chartData.bookingsTrend || []
  const services = chartData.topServices || []
  const langs = chartData.languages || []
  const locCmp = chartData.locationComparison || []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="border-border/80 bg-card/80 dark:bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Bookings trend</CardTitle>
          <p className="text-xs text-muted-foreground">Last 30 days · per location where available
          </p>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trend data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="#7C4DFF" strokeWidth={2} dot={false} />
                {trendKeys.map((k, idx) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    name={k}
                    stroke={accent[(idx + 1) % accent.length]}
                    strokeWidth={1.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 dark:bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Top services</CardTitle>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service breakdown yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8
                  }}
                />
                <Bar dataKey="count" fill="#7C4DFF" radius={[0, 4, 4, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 dark:bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Language distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          {langs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No language data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={langs}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {langs.map((_, i) => (
                    <Cell key={i} fill={accent[i % accent.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/80 dark:bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Location comparison</CardTitle>
        </CardHeader>
        <CardContent className="h-72 w-full min-w-0">
          {locCmp.length === 0 ? (
            <p className="text-sm text-muted-foreground">No location totals yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locCmp} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8
                  }}
                />
                <Bar dataKey="bookings" fill="#34D399" radius={[0, 4, 4, 0]} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
