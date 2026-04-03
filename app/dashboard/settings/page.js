'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Header from '@/components/Header'
import TimeZonePicker from '@/components/TimeZonePicker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Settings, Calendar, CreditCard, Globe } from 'lucide-react'
import { isValidIanaTimeZone } from '@/lib/timezones'
import { PRIMARY_LANGUAGE_OPTIONS } from '@/lib/primary-languages'

function SettingsContent() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [timezone, setTimezone] = useState('')
  const [primaryLanguage, setPrimaryLanguage] = useState('en')
  const [multilingualEnabled, setMultilingualEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('book8_token')
    setToken(t)
    if (!t) router.replace('/')
  }, [router])

  const load = async () => {
    if (!token) return
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
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
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Load failed' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when token; selection synced below
  }, [token])

  useEffect(() => {
    if (!selectedBusinessId || !businesses.length) return
    const biz = businesses.find((b) => b.businessId === selectedBusinessId)
    if (biz) {
      const tz =
        biz.timezone ||
        (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) ||
        'UTC'
      setTimezone(tz)
      setPrimaryLanguage(biz.primaryLanguage || 'en')
      const mlAllowed = biz.planLimits?.multilingual === true
      const stored = biz.multilingualEnabled !== false
      setMultilingualEnabled(mlAllowed ? stored : false)
    }
  }, [selectedBusinessId, businesses])

  const selectedBiz =
    selectedBusinessId && businesses.length
      ? businesses.find((b) => b.businessId === selectedBusinessId)
      : null
  const multilingualAllowed = selectedBiz?.planLimits?.multilingual === true

  const saveSettings = async () => {
    if (!token || !selectedBusinessId) return
    const tz = (timezone || '').trim()
    if (!isValidIanaTimeZone(tz)) {
      setMessage({ type: 'error', text: 'Please choose a valid IANA timezone.' })
      return
    }
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch('/api/business/update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          timezone: tz,
          primaryLanguage,
          multilingualEnabled
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMessage({
        type: 'success',
        text: 'Settings saved. Core API sync attempted in the background.'
      })
      setBusinesses((prev) =>
        prev.map((b) =>
          b.businessId === selectedBusinessId
            ? {
                ...b,
                timezone: tz,
                primaryLanguage: data.primaryLanguage ?? primaryLanguage,
                multilingualEnabled:
                  data.multilingualEnabled !== undefined
                    ? data.multilingualEnabled
                    : multilingualEnabled
              }
            : b
        )
      )
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Save failed' })
    } finally {
      setSaving(false)
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
      <div className="container max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-7 w-7" />
            Business settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Timezone and voice language apply to your AI receptionist and availability. They sync to the core engine
            after you save.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Other settings</CardTitle>
            <CardDescription>Jump to detailed configuration</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/public-profile">
                <Globe className="h-4 w-4 mr-2" />
                Public booking page
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/scheduling">
                <Calendar className="h-4 w-4 mr-2" />
                Scheduling
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/billing">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timezone &amp; language</CardTitle>
            <CardDescription>
              Set your business timezone, default greeting language, and multilingual detection for the AI voice
              agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : businesses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No business yet.{' '}
                <Link href="/dashboard/business" className="text-primary underline">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <>
                {businesses.length > 1 && (
                  <div>
                    <label className="text-sm font-medium">Business</label>
                    <select
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedBusinessId}
                      onChange={(e) => setSelectedBusinessId(e.target.value)}
                    >
                      {businesses.map((b) => (
                        <option key={b.businessId} value={b.businessId}>
                          {b.name} ({b.businessId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <TimeZonePicker
                  value={timezone}
                  onChange={setTimezone}
                  idPrefix="dash-settings"
                />

                <div className="space-y-2">
                  <Label htmlFor="dash-primary-language">Primary language</Label>
                  <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
                    <SelectTrigger id="dash-primary-language" className="w-full">
                      <SelectValue placeholder="Language" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIMARY_LANGUAGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.code} value={opt.code}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default language for greetings; the agent still switches when multilingual is enabled.
                  </p>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <Switch
                    id="dash-multilingual"
                    checked={multilingualAllowed ? multilingualEnabled : false}
                    onCheckedChange={(v) => {
                      if (multilingualAllowed) setMultilingualEnabled(v)
                    }}
                    disabled={!multilingualAllowed}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="dash-multilingual" className="font-medium cursor-pointer">
                      Multilingual enabled
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically detect and respond fluently in 70+ languages (recommended).
                    </p>
                    {!multilingualAllowed && businesses.length > 0 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Included on Growth and Enterprise. Upgrade to enable multilingual AI voice.
                      </p>
                    ) : null}
                  </div>
                </div>

                {message.text && (
                  <p
                    className={`text-sm ${
                      message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                    }`}
                  >
                    {message.text}
                  </p>
                )}

                <Button onClick={saveSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…
                    </>
                  ) : (
                    'Save settings'
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default function BusinessSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
