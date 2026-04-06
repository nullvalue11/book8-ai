'use client'

import React from 'react'
import Link from 'next/link'
import { Building2, MapPin, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const CATEGORY_EMOJI = {
  dental: '🦷',
  medical: '🏥',
  default: '📍'
}

function emojiForCategory(category) {
  const c = String(category || '').toLowerCase()
  if (c.includes('dental')) return CATEGORY_EMOJI.dental
  if (c.includes('medical') || c.includes('health')) return CATEGORY_EMOJI.medical
  return CATEGORY_EMOJI.default
}

export default function LocationCard({ business, metrics, logoUrl }) {
  const bid = business?.businessId || business?.id
  const name = business?.name?.trim() || bid || 'Location'
  const address =
    metrics?.address ||
    [business?.businessProfile?.address?.line1, business?.city].filter(Boolean).join(', ') ||
    business?.city ||
    ''
  const bookingsToday = metrics?.bookingsToday ?? null
  const callsToday = metrics?.callsToday ?? null
  const noShow = metrics?.noShowRate

  return (
    <Link href={`/dashboard?businessId=${encodeURIComponent(bid)}`} className="group block h-full">
      <Card className="h-full border-border/80 bg-card/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-[0_0_28px_-8px_rgba(124,77,255,0.45)] dark:bg-card/60">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-11 w-11 rounded-lg object-cover border border-border shrink-0"
              />
            ) : (
              <span className="text-2xl shrink-0" aria-hidden>
                {emojiForCategory(business?.category)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground leading-tight truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                {name}
              </h3>
              {address ? (
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" aria-hidden />
                  <span className="line-clamp-2">{address}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  {bid}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Today:{' '}
              <span className="text-foreground font-medium">
                {bookingsToday != null ? `${bookingsToday} bookings` : '—'}
              </span>
              {' · '}
              <span className="text-foreground font-medium">
                {callsToday != null ? `${callsToday} calls` : '—'}
              </span>
            </p>
            <p className="text-muted-foreground">
              No-show rate:{' '}
              <span className="text-foreground font-medium">
                {noShow != null && !Number.isNaN(Number(noShow))
                  ? `${Number(noShow).toFixed(1)}%`
                  : '—'}
              </span>
            </p>
          </div>

          <div className="mt-4 flex items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
            View Dashboard
            <ArrowRight className="w-4 h-4 ms-1 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
