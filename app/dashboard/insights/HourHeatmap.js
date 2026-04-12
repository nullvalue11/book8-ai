'use client'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

export default function HourHeatmap({ cells }) {
  if (!Array.isArray(cells) || cells.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6">
        Need at least 14 days of call data
      </p>
    )
  }

  const grid = new Map()
  let max = 1
  for (const c of cells) {
    const k = `${c.dayOfWeek}-${c.hour}`
    grid.set(k, c.count)
    max = Math.max(max, c.count)
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-[320px]">
        <div className="flex gap-0.5 pl-8">
          {DAYS.map((d) => (
            <div key={d} className="w-7 text-[10px] text-center text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        {HOURS.map((h) => (
          <div key={h} className="flex items-center gap-0.5">
            <div className="w-7 text-[10px] text-muted-foreground text-right pr-1">{h}</div>
            {DAYS.map((_, dow) => {
              const n = grid.get(`${dow}-${h}`) || 0
              const intensity = n <= 0 ? 0 : 0.15 + (n / max) * 0.85
              return (
                <div
                  key={`${dow}-${h}`}
                  className="w-7 h-5 rounded-sm border border-border/50"
                  style={{
                    backgroundColor:
                      n <= 0 ? 'transparent' : `hsl(var(--primary) / ${intensity.toFixed(2)})`
                  }}
                  title={`${DAYS[dow]} ${h}:00 — ${n} calls`}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
