'use client'

import { useEffect, useState } from 'react'
import { normalizeHandoffContextRecord } from '@/lib/setupAuthReturnContext'

/**
 * Lightweight preview when user arrives at /setup sign-in with homepage handoff params.
 * BOO-AUTH-CTX-PRESERVATION-1B
 * @param {{ placeId?: string, url?: string, sessionToken?: string }} props
 */
export default function SignInContextCard({ placeId, url, sessionToken }) {
  const [preview, setPreview] = useState(/** @type {{ name?: string, address?: string, url?: string } | null} */ (null))

  useEffect(() => {
    let cancelled = false
    const pidRaw = (placeId || '').trim()
    const stRaw = (sessionToken || '').trim()
    const handoff = { placeId: pidRaw, sessionToken: stRaw }
    normalizeHandoffContextRecord(handoff)
    const pid = (handoff.placeId || '').trim()

    if (pid) {
      const qs = new URLSearchParams()
      qs.set('placeId', pid)
      const st = (handoff.sessionToken || '').trim()
      if (st) qs.set('sessionToken', st)
      fetch(`/api/places/details?${qs.toString()}`, { cache: 'no-store' })
        .then((r) => r.json().catch(() => null))
        .then((data) => {
          if (cancelled) return
          if (data && data.ok && typeof data.name === 'string') {
            setPreview({
              name: data.name,
              address: typeof data.formattedAddress === 'string' ? data.formattedAddress : ''
            })
          } else {
            setPreview(null)
          }
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
    } else if (url) {
      setPreview({ url: String(url).trim() })
    } else {
      setPreview(null)
    }
    return () => {
      cancelled = true
    }
  }, [placeId, url, sessionToken])

  if (!preview) return null

  const title = preview.name || preview.url || ''
  if (!title) return null

  return (
    <div className="mb-6 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-green-400" aria-hidden>
          ✓
        </div>
        <div className="min-w-0 text-left">
          <div className="text-sm text-zinc-400">You&apos;ve selected:</div>
          <div className="mt-0.5 font-semibold text-white">{title}</div>
          {preview.address ? <div className="mt-0.5 text-sm text-zinc-400">{preview.address}</div> : null}
          <div className="mt-2 text-sm text-purple-300">Sign in to finish setup — it takes 2 minutes.</div>
        </div>
      </div>
    </div>
  )
}
