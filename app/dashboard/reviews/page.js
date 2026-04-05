'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Star } from 'lucide-react'
import Header from '@/components/Header'
import { getBookingTranslations } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'

export default function DashboardReviewsPage() {
  const router = useRouter()
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const t = useMemo(() => getBookingTranslations(lang), [lang])
  const rv = t.reviews

  const [token, setToken] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [patchingId, setPatchingId] = useState(null)
  const [filterRating, setFilterRating] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
      const res = await fetch('/api/business/reviews', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReviews(Array.isArray(data.reviews) ? data.reviews : [])
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const filtered = useMemo(() => {
    let list = [...reviews]
    if (filterRating !== 'all') {
      const n = Number(filterRating)
      list = list.filter((r) => r.rating === n)
    }
    if (filterStatus !== 'all') {
      list = list.filter((r) =>
        filterStatus === 'hidden' ? r.status === 'hidden' : r.status !== 'hidden'
      )
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      if (!Number.isNaN(from)) {
        list = list.filter((r) => new Date(r.createdAt).getTime() >= from)
      }
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime()
      if (!Number.isNaN(to)) {
        list = list.filter((r) => new Date(r.createdAt).getTime() <= to + 86400000)
      }
    }
    return list
  }, [reviews, filterRating, filterStatus, dateFrom, dateTo])

  const summary = useMemo(() => {
    const published = reviews.filter((r) => r.status !== 'hidden')
    const n = published.length
    const avg =
      n > 0 ? published.reduce((a, r) => a + r.rating, 0) / n : 0
    const now = Date.now()
    const d30 = now - 30 * 86400000
    const recent = published.filter((r) => new Date(r.createdAt).getTime() >= d30).length
    const prevWinStart = d30 - 30 * 86400000
    const prev = published.filter((r) => {
      const ts = new Date(r.createdAt).getTime()
      return ts >= prevWinStart && ts < d30
    }).length
    return { avg, total: n, recent, prev }
  }, [reviews])

  const toggleHidden = async (reviewId, nextStatus) => {
    if (!token) return
    setPatchingId(reviewId)
    try {
      const res = await fetch('/api/business/reviews', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reviewId, status: nextStatus })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: nextStatus } : r))
      )
    } catch {
      /* toast optional */
    } finally {
      setPatchingId(null)
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
            <Star className="h-7 w-7" />
            {rv.dashboardTitle}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{rv.dashboardSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{rv.summaryAvg}</CardDescription>
              <CardTitle className="text-2xl">
                {summary.total ? summary.avg.toFixed(1) : '—'}
                {summary.total ? <span className="text-yellow-500 ml-1">★</span> : null}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{rv.summaryTotal}</CardDescription>
              <CardTitle className="text-2xl">{summary.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{rv.summaryTrend}</CardDescription>
              <CardTitle className="text-2xl">{summary.recent}</CardTitle>
              {summary.prev > 0 ? (
                <p className="text-xs text-muted-foreground">
                  vs {summary.prev} prior window
                </p>
              ) : null}
            </CardHeader>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">{rv.managementHint}</p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rv.filterRating}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>{rv.filterRating}</Label>
              <Select value={filterRating} onValueChange={setFilterRating}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{rv.all}</SelectItem>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} ★
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{rv.filterStatus}</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{rv.all}</SelectItem>
                  <SelectItem value="published">{rv.statusPublished}</SelectItem>
                  <SelectItem value="hidden">{rv.statusHidden}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{rv.dateFrom}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{rv.dateTo}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{rv.noReviews}</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((r) => (
              <Card key={r.id} className={r.status === 'hidden' ? 'opacity-70 border-dashed' : ''}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-yellow-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s}>{s <= r.rating ? '★' : '☆'}</span>
                      ))}
                      <span className="text-muted-foreground text-sm text-foreground">
                        {r.customerName}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          r.status === 'hidden'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {r.status === 'hidden' ? rv.statusHidden : rv.statusPublished}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={patchingId === r.id}
                      onClick={() =>
                        toggleHidden(r.id, r.status === 'hidden' ? 'published' : 'hidden')
                      }
                    >
                      {patchingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : r.status === 'hidden' ? (
                        rv.show
                      ) : (
                        rv.hide
                      )}
                    </Button>
                  </div>
                  {r.comment ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap" dir="auto">
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {r.businessName} · {r.serviceName || rv.service}{' '}
                    ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
