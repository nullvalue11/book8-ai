'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

/**
 * @param {{
 *  authToken: string | null,
 *  labels: import('@/lib/translations').BookingTranslations['googlePlaces'],
 *  inputClassName?: string,
 *  labelClassName?: string,
 *  onPick: (payload: { placeId: string, details: unknown }) => void,
 *  idPrefix?: string
 * }} props
 */
export default function GooglePlacesSearch({
  authToken,
  labels,
  inputClassName = '',
  labelClassName = '',
  onPick,
  idPrefix = 'gplaces'
}) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (query.length < 3) {
      setPredictions([])
      setLoading(false)
      return
    }
    if (!authToken) return

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/autocomplete?query=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: 'no-store'
          }
        )
        const data = await res.json().catch(() => ({}))
        setPredictions(Array.isArray(data.predictions) ? data.predictions : [])
      } catch {
        setPredictions([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, authToken])

  const pickPrediction = useCallback(
    async (p) => {
      const placeId = p.placeId || p.place_id || p.id
      if (!placeId || !authToken) return
      setOpen(false)
      setLoading(true)
      try {
        const res = await fetch(
          `/api/places/details?placeId=${encodeURIComponent(placeId)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            cache: 'no-store'
          }
        )
        const details = await res.json().catch(() => null)
        onPick?.({ placeId, details: res.ok ? details : null })
      } catch {
        onPick?.({ placeId, details: null })
      } finally {
        setLoading(false)
      }
    },
    [authToken, onPick]
  )

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <Label htmlFor={`${idPrefix}-search`} className={labelClassName}>
        {labels.findYourBusiness}
      </Label>
      <div className="relative">
        <Input
          id={`${idPrefix}-search`}
          className={inputClassName}
          placeholder={labels.searchPlaceholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {loading ? (
          <div className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          </div>
        ) : null}
      </div>
      {open && query.length >= 3 && predictions.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#1e1e2e] bg-[#12121A] py-1 shadow-xl"
          role="listbox"
        >
          {predictions.slice(0, 5).map((p, i) => {
            const main = p.structured_formatting?.main_text || p.mainText || p.description || p.name || ''
            const sec = p.structured_formatting?.secondary_text || p.secondaryText || ''
            const pid = p.placeId || p.place_id || p.id || `pred-${i}`
            return (
              <li key={pid}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-[#1e1e2e]"
                  onClick={() => pickPrediction(p)}
                >
                  <span className="font-medium block truncate">{main}</span>
                  {sec ? <span className="text-xs text-slate-400 block truncate">{sec}</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {open && query.length >= 3 && !loading && predictions.length === 0 && authToken ? (
        <p className="text-xs text-slate-500">{labels.noResults}</p>
      ) : null}
    </div>
  )
}

/** Optional skip control for parent layout */
export function GooglePlacesSkipButton({ labels, onClick, className = '' }) {
  return (
    <Button type="button" variant="ghost" className={`text-slate-400 hover:text-white ${className}`} onClick={onClick}>
      {labels.skip}
    </Button>
  )
}
