'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' }
]

export function defaultHoursForCategory(category) {
  const c = String(category || '').trim()
  if (c === 'barber') {
    return {
      monday: { isOpen: true, start: '09:00', end: '19:00' },
      tuesday: { isOpen: true, start: '09:00', end: '19:00' },
      wednesday: { isOpen: true, start: '09:00', end: '19:00' },
      thursday: { isOpen: true, start: '09:00', end: '19:00' },
      friday: { isOpen: true, start: '09:00', end: '19:00' },
      saturday: { isOpen: true, start: '09:00', end: '17:00' },
      sunday: { isOpen: false, start: null, end: null }
    }
  }
  if (c === 'dental') {
    return {
      monday: { isOpen: true, start: '08:00', end: '17:00' },
      tuesday: { isOpen: true, start: '08:00', end: '17:00' },
      wednesday: { isOpen: true, start: '08:00', end: '17:00' },
      thursday: { isOpen: true, start: '08:00', end: '17:00' },
      friday: { isOpen: true, start: '08:00', end: '17:00' },
      saturday: { isOpen: false, start: null, end: null },
      sunday: { isOpen: false, start: null, end: null }
    }
  }
  if (c === 'spa') {
    return {
      monday: { isOpen: false, start: null, end: null },
      tuesday: { isOpen: true, start: '10:00', end: '19:00' },
      wednesday: { isOpen: true, start: '10:00', end: '19:00' },
      thursday: { isOpen: true, start: '10:00', end: '19:00' },
      friday: { isOpen: true, start: '10:00', end: '19:00' },
      saturday: { isOpen: true, start: '10:00', end: '19:00' },
      sunday: { isOpen: true, start: '10:00', end: '16:00' }
    }
  }
  if (c === 'fitness') {
    return {
      monday: { isOpen: true, start: '06:00', end: '22:00' },
      tuesday: { isOpen: true, start: '06:00', end: '22:00' },
      wednesday: { isOpen: true, start: '06:00', end: '22:00' },
      thursday: { isOpen: true, start: '06:00', end: '22:00' },
      friday: { isOpen: true, start: '06:00', end: '22:00' },
      saturday: { isOpen: true, start: '06:00', end: '22:00' },
      sunday: { isOpen: true, start: '06:00', end: '22:00' }
    }
  }
  if (c === 'physio') {
    return {
      monday: { isOpen: true, start: '08:00', end: '18:00' },
      tuesday: { isOpen: true, start: '08:00', end: '18:00' },
      wednesday: { isOpen: true, start: '08:00', end: '18:00' },
      thursday: { isOpen: true, start: '08:00', end: '18:00' },
      friday: { isOpen: true, start: '08:00', end: '18:00' },
      saturday: { isOpen: false, start: null, end: null },
      sunday: { isOpen: false, start: null, end: null }
    }
  }
  return {
    monday: { isOpen: true, start: '09:00', end: '17:00' },
    tuesday: { isOpen: true, start: '09:00', end: '17:00' },
    wednesday: { isOpen: true, start: '09:00', end: '17:00' },
    thursday: { isOpen: true, start: '09:00', end: '17:00' },
    friday: { isOpen: true, start: '09:00', end: '17:00' },
    saturday: { isOpen: false, start: null, end: null },
    sunday: { isOpen: false, start: null, end: null }
  }
}

export default function HoursEditor({ value, onChange }) {
  const hours = value || defaultHoursForCategory('other')

  const updateDay = (dayKey, patch) => {
    onChange?.({ ...hours, [dayKey]: { ...(hours[dayKey] || {}), ...patch } })
  }

  return (
    <div className="space-y-3">
      {DAYS.map((d) => {
        const row = hours[d.key] || { isOpen: false, start: null, end: null }
        const isOpen = !!row.isOpen
        return (
          <div
            key={d.key}
            className={cn(
              'rounded-2xl border border-white/10 bg-[#0A0A0F] px-4 py-3',
              'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
            )}
          >
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <div className="flex items-center gap-3">
                <div className="w-12 text-sm font-semibold text-white">{d.label}</div>
                <div className="text-xs text-[#94A3B8]">
                  {isOpen ? 'Open' : 'Closed'}
                </div>
              </div>
              <div className="sm:hidden">
                <Switch
                  checked={isOpen}
                  onCheckedChange={(checked) =>
                    updateDay(d.key, checked ? { isOpen: true, start: '09:00', end: '17:00' } : { isOpen: false, start: null, end: null })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="hidden sm:block">
                <Switch
                  checked={isOpen}
                  onCheckedChange={(checked) =>
                    updateDay(d.key, checked ? { isOpen: true, start: '09:00', end: '17:00' } : { isOpen: false, start: null, end: null })
                  }
                />
              </div>
              {isOpen ? (
                <div className="flex flex-1 items-center gap-2 justify-end">
                  <input
                    type="time"
                    value={row.start || '09:00'}
                    onChange={(e) => updateDay(d.key, { start: e.target.value })}
                    className="h-10 rounded-md border border-white/10 bg-[#0A0A0F] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
                  />
                  <span className="text-xs text-[#64748B]">to</span>
                  <input
                    type="time"
                    value={row.end || '17:00'}
                    onChange={(e) => updateDay(d.key, { end: e.target.value })}
                    className="h-10 rounded-md border border-white/10 bg-[#0A0A0F] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
                  />
                </div>
              ) : (
                <div className="text-xs text-[#64748B]">Closed</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

