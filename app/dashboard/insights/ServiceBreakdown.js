'use client'

import { formatMoney, blurMoney } from '@/lib/formatCurrency'
import { useBlur } from './BlurContext'

export default function ServiceBreakdown({ topServices, currency }) {
  const { blurred } = useBlur()
  if (!Array.isArray(topServices) || topServices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        Add services in your dashboard to see breakdowns
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {topServices.map((s) => (
        <li key={s.serviceId} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="font-medium truncate">{s.name}</span>
            <span className="text-muted-foreground shrink-0">
              {s.count} ·{' '}
              {blurred ? blurMoney(s.revenue, currency) : formatMoney(s.revenue, currency)} ·{' '}
              {s.pctOfTotal}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${Math.min(100, s.pctOfTotal)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
