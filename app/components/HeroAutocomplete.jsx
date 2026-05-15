'use client'

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const KNOWN_TLDS = new Set([
  'com',
  'io',
  'net',
  'org',
  'co',
  'ai',
  'app',
  'me',
  'biz',
  'info',
  'ca',
  'uk',
  'us',
  'eu',
  'de',
  'fr'
])

/**
 * @param {string} raw
 */
function looksLikeDomainInput(raw) {
  const t = String(raw || '').trim()
  if (!t || /\s/.test(t)) return false
  if (/\.(com|io|net|org|co|ai|app|me|biz|info)$/i.test(t)) return true
  const parts = t.split('.')
  if (parts.length < 2) return false
  const last = parts[parts.length - 1].split('/')[0].toLowerCase()
  return KNOWN_TLDS.has(last)
}

/**
 * @typedef {{ type: 'place', placeId: string, name: string, address: string, sessionToken: string }} PlaceSelection
 * @typedef {{ type: 'domain', url: string }} DomainSelection
 */

/**
 * @param {{
 *   placeholder?: string,
 *   className?: string,
 *   inputClassName?: string,
 *   onSelect?: (selection: PlaceSelection | DomainSelection) => void
 * }} props
 */
const HeroAutocomplete = forwardRef(function HeroAutocomplete(
  { placeholder = 'yourbusiness.com or business name', className = '', inputClassName = '', onSelect },
  ref
) {
  const [value, setValue] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState([])
  const [nearCity, setNearCity] = useState(/** @type {string | null} */ (null))
  const [emptyAfterFetch, setEmptyAfterFetch] = useState(false)
  const [ctaHint, setCtaHint] = useState(false)

  const sessionTokenRef = useRef(null)
  const wrapRef = useRef(null)
  const listRef = useRef(null)
  const openedAnalyticsRef = useRef(false)
  const requestIdRef = useRef(0)
  const valueRef = useRef('')
  const pickedRef = useRef(null)

  const [picked, setPicked] = useState(
    /** @type {{ placeId: string, name: string, sessionToken: string } | null} */ (null)
  )

  const domainMode = useMemo(() => looksLikeDomainInput(value), [value])

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    pickedRef.current = picked
  }, [picked])

  const ensureSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `st-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    }
    return sessionTokenRef.current
  }, [])

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null
  }, [])

  useEffect(() => {
    const t = value.trim()
    if (t.length === 0) {
      resetSessionToken()
      setPicked(null)
      setNearCity(null)
    }
    const timer = window.setTimeout(() => setDebounced(value), 250)
    return () => window.clearTimeout(timer)
  }, [value, resetSessionToken])

  useEffect(() => {
    function onDocPointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointerDown)
    return () => document.removeEventListener('mousedown', onDocPointerDown)
  }, [])

  useEffect(() => {
    if (domainMode) {
      setPredictions([])
      setNearCity(null)
      setLoading(false)
      setEmptyAfterFetch(false)
      setOpen(false)
      setHighlight(-1)
      return
    }

    const q = debounced.trim()
    if (q.length < 2) {
      setPredictions([])
      setNearCity(null)
      setLoading(false)
      setEmptyAfterFetch(false)
      setOpen(false)
      setHighlight(-1)
      return
    }

    const token = ensureSessionToken()
    let cancelled = false
    const rid = ++requestIdRef.current

    setLoading(true)
    setEmptyAfterFetch(false)

    ;(async () => {
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(q)}&sessionToken=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled || rid !== requestIdRef.current) return
        const list = Array.isArray(data.predictions) ? data.predictions : []
        const nc =
          typeof data.nearCity === 'string' && data.nearCity.trim() ? data.nearCity.trim() : null
        setNearCity(nc)
        setPredictions(list.slice(0, 5))
        setEmptyAfterFetch(list.length === 0)
        setOpen(list.length > 0)
        setHighlight(-1)
        if (list.length > 0 && listRef.current && typeof window !== 'undefined' && window.matchMedia('(max-width:639px)').matches) {
          window.requestAnimationFrame(() => {
            listRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          })
        }
      } catch {
        if (cancelled || rid !== requestIdRef.current) return
        setPredictions([])
        setNearCity(null)
        setEmptyAfterFetch(false)
        setOpen(false)
      } finally {
        if (!cancelled && rid === requestIdRef.current) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [debounced, domainMode, ensureSessionToken])

  const selectPrediction = useCallback(
    (p) => {
      const placeId = p.placeId || p.place_id
      if (!placeId) return
      const name = p.name || p.mainText || ''
      const st = sessionTokenRef.current || ensureSessionToken()
      setValue(name)
      setPicked({ placeId, name, sessionToken: st })
      setOpen(false)
      setHighlight(-1)
      setPredictions([])
      setNearCity(null)
      setEmptyAfterFetch(false)
      resetSessionToken()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('book8:hero_autocomplete_select', {
            detail: { placeId, name }
          })
        )
      }
      onSelect?.({ type: 'place', placeId, name, address: p.address || '', sessionToken: st })
    },
    [ensureSessionToken, onSelect, resetSessionToken]
  )

  const resolveCtaSelection = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (domainMode) {
      return /** @type {DomainSelection} */ ({ type: 'domain', url: trimmed })
    }
    if (picked && picked.name === trimmed) {
      return /** @type {PlaceSelection} */ ({
        type: 'place',
        placeId: picked.placeId,
        name: picked.name,
        address: '',
        sessionToken: picked.sessionToken
      })
    }
    return null
  }, [value, domainMode, picked])

  useImperativeHandle(
    ref,
    () => ({
      resolveCtaSelection,
      showPickHint: () => {
        const v = valueRef.current.trim()
        if (v.length < 2 || looksLikeDomainInput(v)) return
        const p = pickedRef.current
        if (p && p.name.trim() === v) return
        setCtaHint(true)
      }
    }),
    [resolveCtaSelection]
  )

  const onInputChange = (e) => {
    const next = e.target.value
    setValue(next)
    setCtaHint(false)
    if (picked && next.trim() !== picked.name.trim()) {
      setPicked(null)
    }
    if (!openedAnalyticsRef.current && next.length > 0 && typeof window !== 'undefined') {
      openedAnalyticsRef.current = true
      window.dispatchEvent(new CustomEvent('book8:hero_autocomplete_open'))
    }
  }

  const onInputFocus = () => {
    ensureSessionToken()
    if (!domainMode && predictions.length > 0) setOpen(true)
  }

  const onKeyDown = (e) => {
    if (domainMode || !open || predictions.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % predictions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? predictions.length - 1 : h - 1))
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < predictions.length) {
        e.preventDefault()
        selectPrediction(predictions[highlight])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setHighlight(-1)
    }
  }

  const inputShellClass = cn(
    'relative flex min-h-[44px] items-center border border-slate-200 bg-white transition-colors dark:border-slate-600/70 dark:bg-slate-900/55',
    open && !domainMode && predictions.length > 0
      ? 'rounded-t-xl border-b-0'
      : 'rounded-xl',
    'focus-within:border-slate-300 dark:focus-within:border-[rgba(139,92,246,0.35)]',
    'focus-within:ring-2 focus-within:ring-violet-500/40 dark:focus-within:ring-[#A78BFA]/40'
  )

  const inputClass = cn(
    'h-11 w-full min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500',
    loading ? 'pr-10' : '',
    inputClassName
  )

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div className={inputShellClass}>
        <input
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && predictions.length > 0}
          aria-autocomplete="list"
          aria-controls="hero-autocomplete-listbox"
          placeholder={placeholder}
          value={value}
          onChange={onInputChange}
          onFocus={onInputFocus}
          onKeyDown={onKeyDown}
          className={inputClass}
        />
        {loading ? (
          <div className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </div>
        ) : null}
      </div>

      {domainMode ? (
        <p className="mt-2 inline-flex max-w-full items-center rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-[#6D28D9] dark:border-[rgba(167,139,250,0.35)] dark:bg-[rgba(139,92,246,0.12)] dark:text-[#D4C4FC]">
          Detected website — we&apos;ll extract everything when you continue
        </p>
      ) : null}

      {open && !domainMode && predictions.length > 0 ? (
        <ul
          ref={listRef}
          id="hero-autocomplete-listbox"
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-[60] max-h-[min(50vh,320px)] overflow-auto',
            'rounded-b-xl border border-t-0 border-purple-500/20 bg-zinc-900/95 backdrop-blur-md',
            'shadow-lg dark:border-[rgba(139,92,246,0.22)]'
          )}
        >
          {predictions.map((p, i) => {
            const name = p.name || p.mainText || 'Result'
            const addr = p.address || p.secondaryText || ''
            const selected = i === highlight
            return (
              <li key={p.placeId || i} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    'flex min-h-[44px] w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors sm:min-h-[48px]',
                    selected ? 'bg-purple-500/20' : 'hover:bg-purple-500/10'
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectPrediction(p)}
                >
                  <span className="font-medium text-white">{name}</span>
                  {addr ? <span className="text-sm text-zinc-400">{addr}</span> : null}
                </button>
              </li>
            )
          })}
          {nearCity ? (
            <li className="pointer-events-none border-t border-purple-500/10 px-3 py-1.5 text-xs text-zinc-500">
              Showing results near {nearCity}
            </li>
          ) : null}
        </ul>
      ) : null}

      {!domainMode && emptyAfterFetch && debounced.trim().length >= 2 && !loading ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          No businesses found — try a different name or paste your website
        </p>
      ) : null}

      {ctaHint ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Pick a business from the list to continue.</p>
      ) : null}
    </div>
  )
})

export default HeroAutocomplete

HeroAutocomplete.displayName = 'HeroAutocomplete'
