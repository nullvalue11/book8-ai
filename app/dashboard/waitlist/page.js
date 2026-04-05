'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ArrowLeft, ListTodo, Loader2 } from 'lucide-react'
import Header from '@/components/Header'
import { getBookingTranslations } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'

function timeRangeLabel(wl, tr) {
  const key = String(tr || 'any').toLowerCase()
  if (key === 'morning') return wl.morning
  if (key === 'afternoon') return wl.afternoon
  if (key === 'evening') return wl.evening
  return wl.anyTime
}

function statusLabel(wl, st) {
  const m = {
    waiting: wl.statusWaiting,
    notified: wl.statusNotified,
    booked: wl.statusBooked,
    expired: wl.statusExpired
  }
  return m[String(st)] || String(st)
}

function statusBadgeClass(st) {
  switch (String(st)) {
    case 'waiting':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    case 'notified':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'booked':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'expired':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export default function DashboardWaitlistPage() {
  const router = useRouter()
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const t = useMemo(() => getBookingTranslations(lang), [lang])
  const wl = t.waitlist || {}

  const [token, setToken] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterService, setFilterService] = useState('all')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tok = localStorage.getItem('book8_token')
    setToken(tok)
    if (!tok) router.replace('/')
  }, [router])

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/business/waitlist', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const serviceOptions = useMemo(() => {
    const s = new Set()
    for (const e of entries) {
      const name = (e.serviceName || '').trim()
      if (name) s.add(name)
    }
    return Array.from(s).sort()
  }, [entries])

  const filtered = useMemo(() => {
    let list = [...entries]
    if (filterStatus !== 'all') {
      list = list.filter((e) => e.status === filterStatus)
    }
    if (filterService !== 'all') {
      list = list.filter((e) => (e.serviceName || '').trim() === filterService)
    }
    return list
  }, [entries, filterStatus, filterService])

  const removeEntry = async (entryId) => {
    if (!token || !entryId) return
    if (typeof window !== 'undefined' && !window.confirm(wl.removeConfirm || wl.remove)) return
    setRemovingId(entryId)
    try {
      const res = await fetch(
        `/api/business/waitlist?entryId=${encodeURIComponent(entryId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      /* ignore */
    } finally {
      setRemovingId(null)
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="h-7 w-7" />
            {wl.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{wl.subtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {wl.filterStatus} / {wl.filterService}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>{wl.filterStatus}</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{wl.allStatuses}</SelectItem>
                  <SelectItem value="waiting">{wl.statusWaiting}</SelectItem>
                  <SelectItem value="notified">{wl.statusNotified}</SelectItem>
                  <SelectItem value="booked">{wl.statusBooked}</SelectItem>
                  <SelectItem value="expired">{wl.statusExpired}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{wl.filterService}</Label>
              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{wl.allServices}</SelectItem>
                  {serviceOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{wl.empty}</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((e) => (
              <Card key={e.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{e.customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.email}
                        {e.phone ? ` · ${e.phone}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {e.businessName ? `${e.businessName} · ` : ''}
                        {e.serviceName || '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusBadgeClass(e.status)}`}
                      >
                        {statusLabel(wl, e.status)}
                      </span>
                      {e.status === 'waiting' && e.position != null ? (
                        <span className="text-xs text-muted-foreground">
                          {wl.colPosition} #{e.position}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removingId === e.id}
                        onClick={() => removeEntry(e.id)}
                      >
                        {removingId === e.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          wl.remove
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium text-foreground">{wl.colDates}:</span>{' '}
                      {Array.isArray(e.preferredDates) && e.preferredDates.length
                        ? e.preferredDates.join(', ')
                        : '—'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">{wl.colTimeRange}:</span>{' '}
                      {timeRangeLabel(wl, e.preferredTimeRange)}
                    </p>
                    <p className="text-xs">
                      {wl.colJoined}:{' '}
                      {e.createdAt
                        ? new Date(e.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : '—'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
