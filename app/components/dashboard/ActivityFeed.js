'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react'

function formatAgo(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} hour${h !== 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d !== 1 ? 's' : ''} ago`
}

export default function ActivityFeed({ items, loading }) {
  return (
    <Card className="border-border/80 bg-card/80 dark:bg-card/60">
      <CardHeader>
        <CardTitle className="text-lg">Recent activity</CardTitle>
        <p className="text-sm text-muted-foreground">
          Latest bookings and calls across all locations
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recent activity yet. Data appears as customers book and call.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item, i) => {
              const loc = item.locationName || 'Location'
              const title = item.title || 'Event'
              const isCall = item.kind === 'call'
              const isNoShow =
                String(item.status || '').toLowerCase().includes('no_show') ||
                String(item.status || '').toLowerCase().includes('noshow')
              return (
                <li
                  key={`${item.kind}-${i}-${item.ts}`}
                  className="flex gap-3 text-sm border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <span className="shrink-0 mt-0.5" aria-hidden>
                    {isNoShow ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : isCall ? (
                      <Phone className="w-4 h-4 text-blue-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">
                      {isNoShow ? (
                        <>
                          No-show — <span className="font-medium">{title}</span>, {loc}
                        </>
                      ) : isCall ? (
                        <>
                          Call — <span className="font-medium">{title}</span>, {loc}
                        </>
                      ) : (
                        <>
                          Booking — <span className="font-medium">{title}</span>, {loc}
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden />
                      {formatAgo(item.ts)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
