'use client'

import { useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { Button } from '@/components/ui/button'
import { formatMoney, blurMoney } from '@/lib/formatCurrency'
import { useBlur } from './BlurContext'

function todayKeyInTz(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
      .format(new Date())
      .replace(/\//g, '-')
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default function TrendChart({ trend, currency, businessTimezone }) {
  const [mode, setMode] = useState('revenue')
  const { blurred } = useBlur()
  const todayKey = useMemo(() => todayKeyInTz(businessTimezone), [businessTimezone])

  const data = useMemo(() => {
    if (!Array.isArray(trend)) return []
    return trend.map((row) => ({
      ...row,
      label: row.date?.slice(5) || row.date
    }))
  }, [trend])

  const todayIndex = data.findIndex((d) => d.date === todayKey)

  const formatY = (v) => {
    if (mode === 'bookings') return String(Math.round(v))
    if (blurred) return blurMoney(v, currency)
    return formatMoney(v, currency)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const p = payload[0]?.payload
    if (!p) return null
    const rev = p.revenue
    const bk = p.bookings
    return (
      <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
        <div className="font-medium">{p.date}</div>
        <div className="text-muted-foreground">
          Bookings: {bk}
        </div>
        <div>
          Revenue:{' '}
          {blurred ? blurMoney(rev, currency) : formatMoney(rev, currency)}
        </div>
      </div>
    )
  }

  if (data.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Chart:</span>
        <Button
          type="button"
          variant={mode === 'revenue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('revenue')}
        >
          Revenue
        </Button>
        <Button
          type="button"
          variant={mode === 'bookings' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('bookings')}
        >
          Bookings
        </Button>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                mode === 'bookings'
                  ? String(Math.round(v))
                  : blurred
                    ? blurMoney(v, currency)
                    : formatMoney(v, currency)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            {todayIndex >= 0 ? (
              <ReferenceLine x={data[todayIndex]?.label} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
            ) : null}
            <Line
              type="monotone"
              dataKey={mode === 'revenue' ? 'revenue' : 'bookings'}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
