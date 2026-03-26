'use client'

import React, { useId, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  PRIORITY_TIMEZONES,
  getOrderedTimeZoneIds,
  timeZoneLabel
} from '@/lib/timezones'

export default function TimeZonePicker({
  value,
  onChange,
  labelQuick = 'Quick select (North America)',
  labelSearch = 'Search all timezones',
  idPrefix,
  selectClassName = '',
  inputClassName = '',
  labelClassName = '',
  hintClassName = '',
  className = ''
}) {
  const reactId = useId()
  const base = `${idPrefix || 'tz'}-${reactId.replace(/:/g, '')}`
  const listId = `${base}-list`
  const ordered = useMemo(() => getOrderedTimeZoneIds(), [])
  const prioritySet = useMemo(() => new Set(PRIORITY_TIMEZONES.map((p) => p.value)), [])
  const quickValue = value && prioritySet.has(value) ? value : ''

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <Label htmlFor={`${base}-quick`} className={cn('text-foreground', labelClassName)}>
          {labelQuick}
        </Label>
        <select
          id={`${base}-quick`}
          className={cn(
            'mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectClassName
          )}
          value={quickValue}
          onChange={(e) => {
            const v = e.target.value
            if (v) onChange(v)
          }}
        >
          <option value="">Choose a common timezone…</option>
          {PRIORITY_TIMEZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label} ({z.value})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={listId} className="text-foreground">
          {labelSearch}
        </Label>
        <Input
          id={listId}
          className={`mt-1 bg-background border-border ${inputClassName}`}
          list={`${listId}-options`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type to filter, e.g. Europe/London"
          autoComplete="off"
        />
        <datalist id={`${listId}-options`}>
          {ordered.map((z) => (
            <option key={z} value={z}>
              {timeZoneLabel(z)}
            </option>
          ))}
        </datalist>
        <p className={cn('text-xs text-muted-foreground mt-1', hintClassName)}>
          Pick from suggestions or enter a valid IANA timezone name.
        </p>
      </div>
    </div>
  )
}
