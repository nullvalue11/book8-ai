'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, ChevronUp, ChevronDown, Loader2, ImageIcon } from 'lucide-react'
import Header from '@/components/Header'
import { getBookingTranslations } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const TIME_OPTS = (() => {
  const o = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      o.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return o
})()

const DEFAULT_HOURS = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: []
}

function normalizeServiceList(data) {
  if (Array.isArray(data)) return data
  return data?.services || []
}

function weeklyHoursFromProvider(p) {
  const raw = p?.weeklyHours && typeof p.weeklyHours === 'object' ? p.weeklyHours : {}
  const out = { ...DEFAULT_HOURS }
  for (const d of DAYS) {
    if (Array.isArray(raw[d]) && raw[d].length) {
      out[d] = raw[d].map((x) => ({
        start: String(x.start || '09:00').slice(0, 8),
        end: String(x.end || '17:00').slice(0, 8)
      }))
    } else {
      out[d] = []
    }
  }
  return out
}

export default function ProvidersSettingsPage() {
  const router = useRouter()
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const t = useMemo(() => getBookingTranslations(lang), [lang])
  const ps = t.providersSettings

  const dayLabel = (d) => {
    const k = d.charAt(0).toUpperCase() + d.slice(1)
    const map = {
      Monday: t.monday,
      Tuesday: t.tuesday,
      Wednesday: t.wednesday,
      Thursday: t.thursday,
      Friday: t.friday,
      Saturday: t.saturday,
      Sunday: t.sunday
    }
    return map[k] || k
  }

  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [providers, setProviders] = useState([])
  const [plan, setPlan] = useState('starter')
  const [maxProviders, setMaxProviders] = useState(0)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState({ type: '', text: '' })
  const fileRefs = useRef({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tok = localStorage.getItem('book8_token')
    setToken(tok)
    if (!tok) router.replace('/')
  }, [router])

  const loadBusinesses = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/business/register', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load')
    const list = data.businesses || []
    setBusinesses(list)
    if (list.length) {
      setSelectedBusinessId((prev) =>
        prev && list.some((b) => b.businessId === prev) ? prev : list[0].businessId
      )
    }
  }, [token])

  const loadProviders = useCallback(async () => {
    if (!token || !selectedBusinessId) return
    const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/providers`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || ps.loadError)
    setProviders(Array.isArray(data.providers) ? data.providers : [])
    if (data.plan != null) setPlan(String(data.plan).toLowerCase())
    if (typeof data.maxProviders === 'number') setMaxProviders(data.maxProviders)
  }, [token, selectedBusinessId, ps.loadError])

  const loadServices = useCallback(async () => {
    if (!token || !selectedBusinessId) return
    const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/services`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setServices([])
      return
    }
    setServices(normalizeServiceList(data))
  }, [token, selectedBusinessId])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        await loadBusinesses()
      } catch (e) {
        setMessage({ type: 'error', text: e.message })
      }
    })()
  }, [token, loadBusinesses])

  useEffect(() => {
    if (!token || !selectedBusinessId) return
    ;(async () => {
      setLoading(true)
      setMessage({ type: '', text: '' })
      try {
        await Promise.all([loadProviders(), loadServices()])
      } catch (e) {
        setMessage({ type: 'error', text: e.message || ps.loadError })
      } finally {
        setLoading(false)
      }
    })()
  }, [token, selectedBusinessId, loadProviders, loadServices, ps.loadError])

  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  }, [providers])

  const activeCount = useMemo(
    () => providers.filter((p) => p && p.active !== false).length,
    [providers]
  )

  const canAdd = maxProviders === -1 || activeCount < maxProviders

  const setDayHours = (provId, day, closed, startV, endV) => {
    setProviders((list) =>
      list.map((p) => {
        if (p.id !== provId) return p
        const wh = weeklyHoursFromProvider(p)
        if (closed) {
          wh[day] = []
        } else {
          wh[day] = [{ start: startV || '09:00', end: endV || '17:00' }]
        }
        return { ...p, weeklyHours: wh }
      })
    )
  }

  const patchProviderField = (provId, patch) => {
    setProviders((list) => list.map((p) => (p.id === provId ? { ...p, ...patch } : p)))
  }

  const toggleService = (provId, serviceId, checked) => {
    setProviders((list) =>
      list.map((p) => {
        if (p.id !== provId) return p
        const ids = new Set(Array.isArray(p.serviceIds) ? p.serviceIds.map(String) : [])
        if (checked) ids.add(String(serviceId))
        else ids.delete(String(serviceId))
        return { ...p, serviceIds: [...ids] }
      })
    )
  }

  const saveProvider = async (p) => {
    if (!token || !selectedBusinessId) return
    setSavingId(p.id)
    setMessage({ type: '', text: '' })
    try {
      const weeklyHours = weeklyHoursFromProvider(p)
      const body = {
        name: (p.name || '').trim(),
        title: (p.title || '').trim() || null,
        email: (p.email || '').trim() || null,
        phone: (p.phone || '').trim() || null,
        serviceIds: Array.isArray(p.serviceIds) ? p.serviceIds : [],
        weeklyHours,
        active: p.active !== false,
        sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : 0
      }
      if (p.avatar?.url && /^https?:\/\//i.test(String(p.avatar.url))) {
        body.avatar = { url: String(p.avatar.url).trim() }
      }
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/providers/${encodeURIComponent(p.id)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || ps.saveError)
      setProviders(Array.isArray(data.providers) ? data.providers : providers)
      setMessage({ type: 'success', text: ps.saveSuccess })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || ps.saveError })
    } finally {
      setSavingId(null)
    }
  }

  const addProvider = async () => {
    if (!token || !selectedBusinessId || !canAdd) return
    setSavingId('__new__')
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/providers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: ps.newProvider })
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403) {
        setMessage({
          type: 'error',
          text: data.error === 'UPGRADE_REQUIRED' ? ps.upgradeGrowth : ps.atCapacity
        })
        return
      }
      if (!res.ok) throw new Error(data.error || ps.saveError)
      setProviders(Array.isArray(data.providers) ? data.providers : [])
    } catch (e) {
      setMessage({ type: 'error', text: e.message || ps.saveError })
    } finally {
      setSavingId(null)
    }
  }

  const deactivateProvider = async (p) => {
    if (!token || !selectedBusinessId) return
    if (!window.confirm(`Deactivate ${p.name || 'this provider'}?`)) return
    setSavingId(p.id)
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/providers/${encodeURIComponent(p.id)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || ps.saveError)
      setProviders(Array.isArray(data.providers) ? data.providers : [])
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSavingId(null)
    }
  }

  const moveProvider = async (index, dir) => {
    const j = index + dir
    if (j < 0 || j >= sortedProviders.length) return
    const list = [...sortedProviders]
    const [x] = list.splice(index, 1)
    list.splice(j, 0, x)
    const orderIds = list.map((p) => p.id)
    if (!token || !selectedBusinessId) return
    setSavingId('__reorder__')
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/providers/${encodeURIComponent(orderIds[0])}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reorder: orderIds })
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || ps.saveError)
      setProviders(Array.isArray(data.providers) ? data.providers : providers)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSavingId(null)
    }
  }

  const uploadAvatar = async (prov, fileList) => {
    const file = fileList?.[0]
    if (!file || !token || !selectedBusinessId) return
    setSavingId(prov.id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/providers/${encodeURIComponent(prov.id)}/avatar`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || ps.saveError)
      if (data.url) {
        patchProviderField(prov.id, { avatar: { url: data.url } })
      }
      await loadProviders()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold">{ps.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{ps.subtitle}</p>
        </div>

        {message.text ? (
          <p
            className={`text-sm rounded-md px-3 py-2 ${
              message.type === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {message.text}
          </p>
        ) : null}

        {businesses.length > 1 ? (
          <div>
            <Label>Business</Label>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.businessId} value={b.businessId}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {maxProviders === 0 ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">{ps.upgradeGrowth}</CardTitle>
            </CardHeader>
          </Card>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {ps.loading}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{ps.reorderHint}</p>

            {sortedProviders.map((p, idx) => {
              const inactive = p.active === false
              const wh = weeklyHoursFromProvider(p)
              const sid = (s) => String(s.serviceId || s.id || '')
              return (
                <Card key={p.id} className={inactive ? 'opacity-60' : ''}>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                    <div>
                      <CardTitle className="text-base">
                        {p.name || ps.newProvider}
                        {inactive ? (
                          <span className="ms-2 text-xs font-normal text-muted-foreground">
                            ({ps.inactive})
                          </span>
                        ) : null}
                      </CardTitle>
                      <CardDescription>
                        {plan === 'growth' && maxProviders === 5
                          ? `Growth · ${activeCount}/${maxProviders} active`
                          : plan === 'enterprise' || maxProviders === -1
                            ? 'Enterprise · unlimited'
                            : null}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!!savingId || idx === 0}
                        onClick={() => moveProvider(idx, -1)}
                        aria-label={ps.moveUp}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!!savingId || idx >= sortedProviders.length - 1}
                        onClick={() => moveProvider(idx, 1)}
                        aria-label={ps.moveDown}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label>{ps.name}</Label>
                        <Input
                          className="mt-1"
                          value={p.name || ''}
                          disabled={inactive}
                          onChange={(e) => patchProviderField(p.id, { name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{ps.titleField}</Label>
                        <Input
                          className="mt-1"
                          value={p.title || ''}
                          disabled={inactive}
                          onChange={(e) => patchProviderField(p.id, { title: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{ps.email}</Label>
                        <Input
                          className="mt-1"
                          type="email"
                          value={p.email || ''}
                          disabled={inactive}
                          onChange={(e) => patchProviderField(p.id, { email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{ps.phone}</Label>
                        <Input
                          className="mt-1"
                          type="tel"
                          value={p.phone || ''}
                          disabled={inactive}
                          onChange={(e) => patchProviderField(p.id, { phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>{ps.avatarUrl}</Label>
                      <Input
                        className="mt-1"
                        placeholder="https://"
                        value={p.avatar?.url || ''}
                        disabled={inactive}
                        onChange={(e) =>
                          patchProviderField(p.id, {
                            avatar: e.target.value.trim()
                              ? { url: e.target.value.trim() }
                              : null
                          })
                        }
                      />
                      <div className="flex items-center gap-3 mt-2">
                        {p.avatar?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatar.url}
                            alt=""
                            className="w-14 h-14 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full border border-dashed flex items-center justify-center bg-muted/40">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <input
                            ref={(el) => {
                              fileRefs.current[p.id] = el
                            }}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={inactive}
                            onChange={(e) => {
                              uploadAvatar(p, e.target.files)
                              e.target.value = ''
                            }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={inactive || !!savingId}
                            onClick={() => fileRefs.current[p.id]?.click()}
                          >
                            {ps.uploadAvatar}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>{ps.services}</Label>
                      <p className="text-xs text-muted-foreground mt-1">{ps.allServicesHint}</p>
                      {services.length === 0 ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">{ps.noServices}</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                          {services.map((s) => {
                            const id = sid(s)
                            const checked = (p.serviceIds || []).map(String).includes(id)
                            return (
                              <label key={id || s.name} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  disabled={inactive}
                                  checked={checked}
                                  onChange={(e) => toggleService(p.id, id, e.target.checked)}
                                />
                                {s.name || id}
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>{ps.weeklyHoursSection}</Label>
                      <p className="text-xs text-muted-foreground mt-1">{ps.hoursHelp}</p>
                      <div className="mt-2 space-y-2">
                        {DAYS.map((day) => {
                          const open = (wh[day] || []).length > 0
                          const seg = wh[day]?.[0]
                          return (
                            <div
                              key={day}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-md p-2"
                            >
                              <span className="text-sm w-28 shrink-0">{dayLabel(day)}</span>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={open}
                                  disabled={inactive}
                                  onChange={(e) =>
                                    setDayHours(p.id, day, !e.target.checked, seg?.start, seg?.end)
                                  }
                                />
                                Open
                              </label>
                              {open ? (
                                <div className="flex flex-wrap gap-2 items-center">
                                  <Select
                                    value={seg?.start || '09:00'}
                                    disabled={inactive}
                                    onValueChange={(v) =>
                                      setDayHours(p.id, day, false, v, seg?.end || '17:00')
                                    }
                                  >
                                    <SelectTrigger className="w-[100px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48">
                                      {TIME_OPTS.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-muted-foreground">–</span>
                                  <Select
                                    value={seg?.end || '17:00'}
                                    disabled={inactive}
                                    onValueChange={(v) =>
                                      setDayHours(p.id, day, false, seg?.start || '09:00', v)
                                    }
                                  >
                                    <SelectTrigger className="w-[100px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-48">
                                      {TIME_OPTS.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={inactive || !!savingId || !(p.name || '').trim()}
                        onClick={() => saveProvider(p)}
                      >
                        {savingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {ps.save}
                      </Button>
                      {!inactive ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive"
                          disabled={!!savingId}
                          onClick={() => deactivateProvider(p)}
                        >
                          {ps.deactivate}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {maxProviders > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={!canAdd || !!savingId}
                onClick={addProvider}
              >
                {savingId === '__new__' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {ps.addProvider}
              </Button>
            ) : null}

            {!canAdd && maxProviders > 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">{ps.atCapacity}</p>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}
