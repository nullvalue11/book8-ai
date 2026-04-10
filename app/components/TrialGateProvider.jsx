'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const TrialGateContext = createContext({
  status: 'loading',
  readOnly: false,
  locked: false,
  daysRemaining: null,
  graceDaysRemaining: null,
  refresh: async () => {}
})

export function useTrialGate() {
  return useContext(TrialGateContext)
}

/**
 * BOO-98B: Trial banner, grace read-only wrapper, locked upgrade modal.
 * @param {{ token: string | null, businessId?: string | null, children: import('react').ReactNode }} props
 */
export function TrialGateProvider({ token, businessId: businessIdProp, children }) {
  const [resolvedBusinessId, setResolvedBusinessId] = useState(businessIdProp || null)
  const [state, setState] = useState({
    status: 'loading',
    daysRemaining: null,
    graceDaysRemaining: null,
    locked: false,
    readOnly: false
  })

  useEffect(() => {
    setResolvedBusinessId(businessIdProp || null)
  }, [businessIdProp])

  useEffect(() => {
    if (resolvedBusinessId || !token) return
    let cancelled = false
    fetch('/api/business/register', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok || !Array.isArray(d.businesses) || !d.businesses.length) return
        const id = d.businesses[0]?.businessId || d.businesses[0]?.id
        if (id) setResolvedBusinessId(id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, resolvedBusinessId])

  const refresh = useCallback(async () => {
    if (!token || !resolvedBusinessId) {
      setState({
        status: 'subscribed',
        daysRemaining: null,
        graceDaysRemaining: null,
        locked: false,
        readOnly: false
      })
      return
    }
    const res = await fetch(`/api/businesses/${encodeURIComponent(resolvedBusinessId)}/trial-status`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) {
      setState({
        status: 'subscribed',
        daysRemaining: null,
        graceDaysRemaining: null,
        locked: false,
        readOnly: false
      })
      return
    }
    const st = data.status
    setState({
      status: st,
      daysRemaining: data.daysRemaining ?? null,
      graceDaysRemaining: data.graceDaysRemaining ?? null,
      locked: st === 'locked',
      readOnly: st === 'grace'
    })
  }, [token, resolvedBusinessId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upgradeHref = `/upgrade?businessId=${encodeURIComponent(resolvedBusinessId || '')}`

  const showBanner =
    !!token &&
    !!resolvedBusinessId &&
    ((state.status === 'active' && state.daysRemaining != null && state.daysRemaining < 7) ||
      state.status === 'grace')

  const bannerVariant =
    state.status === 'grace'
      ? 'red'
      : state.daysRemaining != null && state.daysRemaining < 3
        ? 'orange'
        : 'yellow'

  const bannerClass =
    bannerVariant === 'red'
      ? 'mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100'
      : bannerVariant === 'orange'
        ? 'mb-4 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-100'
        : 'mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100'

  const locked = state.locked && !!token && !!resolvedBusinessId
  const readOnly = state.readOnly && !locked

  return (
    <TrialGateContext.Provider
      value={{
        status: state.status,
        readOnly,
        locked,
        daysRemaining: state.daysRemaining,
        graceDaysRemaining: state.graceDaysRemaining,
        refresh
      }}
    >
      {showBanner && (
        <div className={bannerClass} role="status">
          {state.status === 'grace' ? (
            <p>
              Trial ended. Dashboard is read-only. Your phone agent may still be active during the grace period.{' '}
              <Link href={upgradeHref} className="font-semibold underline pointer-events-auto">
                Upgrade now
              </Link>{' '}
              to restore full access.
            </p>
          ) : (
            <p>
              {state.daysRemaining} day{state.daysRemaining === 1 ? '' : 's'} left in your trial.{' '}
              <Link href={upgradeHref} className="font-semibold underline pointer-events-auto">
                Upgrade anytime
              </Link>
              .
            </p>
          )}
        </div>
      )}
      {locked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-xl pointer-events-auto">
            <h2 className="text-xl font-bold text-foreground mb-2">Trial ended</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your phone agent is paused until you subscribe. Upgrade to Growth to restore service.
            </p>
            <Button asChild className="w-full">
              <Link href={upgradeHref}>Upgrade to Growth — $99/mo</Link>
            </Button>
          </div>
        </div>
      )}
      <div className={readOnly ? 'pointer-events-none opacity-[0.65] select-none' : ''} title={readOnly ? 'Upgrade to edit' : undefined}>
        {children}
      </div>
    </TrialGateContext.Provider>
  )
}
