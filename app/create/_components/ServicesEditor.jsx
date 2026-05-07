'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const DURATION_OPTIONS = [15, 30, 45, 60, 90]

function formatCents(cents) {
  if (cents == null) return ''
  const n = Number(cents)
  if (!Number.isFinite(n)) return ''
  return String((Math.max(0, Math.round(n)) / 100).toFixed(2)).replace(/\.00$/, '')
}

function parsePriceToCents(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const num = Number(cleaned)
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.round(num * 100))
}

export default function ServicesEditor({ value, onChange, error }) {
  const rows = Array.isArray(value) ? value : []

  const updateRow = (id, patch) => {
    onChange?.(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeRow = (id) => {
    onChange?.(rows.filter((r) => r.id !== id))
  }

  const addRow = () => {
    onChange?.([
      ...rows,
      { id: `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: '', durationMinutes: 30, priceCents: null }
    ])
  }

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                'rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3',
                'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
              )}
            >
              <Input
                className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B] sm:flex-1"
                placeholder="Service name"
                value={row.name || ''}
                onChange={(e) => updateRow(row.id, { name: e.target.value })}
                aria-label="Service name"
              />
              <div className="flex items-center gap-2 sm:shrink-0 sm:justify-end">
                <select
                  className="h-11 rounded-md border border-white/10 bg-[#0A0A0F] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
                  value={String(row.durationMinutes || 30)}
                  onChange={(e) => updateRow(row.id, { durationMinutes: Number(e.target.value) })}
                  aria-label="Duration"
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <Input
                  className="h-11 w-28 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B] tabular-nums"
                  placeholder="$"
                  inputMode="decimal"
                  value={formatCents(row.priceCents)}
                  onChange={(e) => updateRow(row.id, { priceCents: parsePriceToCents(e.target.value) })}
                  aria-label="Price"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove service"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
          onClick={addRow}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add another service
        </Button>
        {error ? <p className="text-sm text-amber-200/90">{error}</p> : null}
      </div>
    </div>
  )
}

