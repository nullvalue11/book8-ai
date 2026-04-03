'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Shield } from 'lucide-react'
import Header from '@/components/Header'
import { getBookingTranslations } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'
import { normalizePlanKey } from '@/lib/plan-features'

const WINDOWS = [1, 2, 4, 6, 12, 24, 48, 72]

export default function NoShowSettingsPage() {
  const router = useRouter()
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const t = useMemo(() => getBookingTranslations(lang), [lang])
  const ns = t.noShow

  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [plan, setPlan] = useState('starter')
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [enabled, setEnabled] = useState(false)
  const [feeType, setFeeType] = useState('fixed')
  const [feeAmount, setFeeAmount] = useState(25)
  const [cancellationWindowHours, setCancellationWindowHours] = useState(24)
  const [autoCharge, setAutoCharge] = useState(true)
  const [currency, setCurrency] = useState('cad')

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

  const loadSettings = useCallback(async () => {
    if (!token || !selectedBusinessId) return
    const res = await fetch(
      `/api/business/${encodeURIComponent(selectedBusinessId)}/no-show-settings`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load')
    setPlan(data.plan || 'starter')
    setAllowed(!!data.allowed)
    const s = data.settings || {}
    setEnabled(!!s.enabled)
    setFeeType(s.feeType === 'percentage' ? 'percentage' : 'fixed')
    setFeeAmount(typeof s.feeAmount === 'number' ? s.feeAmount : Number(s.feeAmount) || 0)
    setCancellationWindowHours(s.cancellationWindowHours || 24)
    setAutoCharge(s.autoCharge !== false)
    setCurrency(s.currency || 'cad')
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
        await loadSettings()
      } catch (e) {
        setMessage({ type: 'error', text: e.message })
      } finally {
        setLoading(false)
      }
    })()
  }, [token, selectedBusinessId, loadSettings])

  const planKey = normalizePlanKey(plan)
  const growthPlus = planKey === 'growth' || planKey === 'enterprise'

  async function save() {
    if (!token || !selectedBusinessId || !allowed) return
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/no-show-settings`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            enabled,
            feeType,
            feeAmount,
            cancellationWindowHours,
            autoCharge,
            currency
          })
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMessage({ type: 'success', text: ns.settingsSaved })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-2xl mx-auto p-6 space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/settings" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Settings
          </Link>
        </Button>

        <div className="flex items-start gap-3">
          <Shield className="h-8 w-8 shrink-0 text-violet-500" />
          <div>
            <h1 className="text-2xl font-bold">{ns.settingsTitle}</h1>
            <p className="text-muted-foreground text-sm mt-1">{ns.settingsSubtitle}</p>
          </div>
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

        {!growthPlus || !allowed ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ns.upgradeToGrowth}</CardTitle>
              <CardDescription>
                <Link href="/dashboard/settings/billing" className="text-primary underline">
                  View billing &amp; plans
                </Link>
              </CardDescription>
            </CardHeader>
          </Card>
        ) : loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="ns-enable">{ns.enableLabel}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Guests complete a card step on your public booking page.
                  </p>
                </div>
                <Switch id="ns-enable" checked={enabled} onCheckedChange={setEnabled} />
              </div>

              <div>
                <Label>Fee type</Label>
                <Select value={feeType} onValueChange={setFeeType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{ns.feeTypeFixed}</SelectItem>
                    <SelectItem value="percentage">{ns.feeTypePercent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  {feeType === 'percentage' ? `${ns.feeAmountLabel} (%)` : ns.feeAmountLabel}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={feeType === 'percentage' ? 1 : 0.01}
                  className="mt-1"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(Number(e.target.value) || 0)}
                />
                {feeType === 'percentage' ? (
                  <p className="text-xs text-muted-foreground mt-1">{ns.feePercentHint}</p>
                ) : null}
              </div>

              <div>
                <Label>{ns.windowLabel}</Label>
                <Select
                  value={String(cancellationWindowHours)}
                  onValueChange={(v) => setCancellationWindowHours(Number(v))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WINDOWS.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h} {ns.hourSuffix}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ns-cur">Currency</Label>
                <Input
                  id="ns-cur"
                  className="mt-1 uppercase max-w-[120px]"
                  maxLength={3}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toLowerCase().slice(0, 3))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="ns-auto">{ns.autoChargeLabel}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{ns.autoChargeHint}</p>
                </div>
                <Switch id="ns-auto" checked={autoCharge} onCheckedChange={setAutoCharge} />
              </div>

              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {ns.saveSettings}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
