'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Phone, MapPin, Percent } from 'lucide-react'

export default function AggregateStats({ stats, loading }) {
  const cards = [
    {
      label: 'Total Bookings',
      value: loading ? '—' : stats.totalBookings.toLocaleString(),
      sub: 'This month',
      icon: Calendar
    },
    {
      label: 'Total Calls',
      value: loading ? '—' : stats.totalCalls.toLocaleString(),
      sub: 'This month',
      icon: Phone
    },
    {
      label: 'No-Show Rate',
      value:
        loading || stats.noShowRate == null
          ? '—'
          : `${Number(stats.noShowRate).toFixed(1)}%`,
      sub: '30-day avg',
      icon: Percent
    },
    {
      label: 'Active Locations',
      value: loading ? '—' : String(stats.activeLocations),
      sub: 'All operational',
      icon: MapPin
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, icon: Icon }) => (
        <Card
          key={label}
          className="border-border/80 bg-card/80 backdrop-blur-sm shadow-sm dark:border-border dark:bg-card/60"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-brand-500 shrink-0" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
