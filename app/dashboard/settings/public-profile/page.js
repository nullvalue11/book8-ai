'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Globe, ImageIcon } from 'lucide-react'
import Header from '@/components/Header'
import PublicBusinessInfoPanel from '@/components/public/PublicBusinessInfoPanel'
import { getBookingTranslations } from '@/lib/translations'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { getSubdivisionsForCountry } from '@/lib/region-data'
import { sanitizeBusinessProfileForPublic } from '@/lib/businessProfile'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

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

function emptyForm() {
  return {
    street: '',
    street2: '',
    city: '',
    provinceState: '',
    postalCode: '',
    country: 'US',
    phone: '',
    email: '',
    description: '',
    website: '',
    socialInstagram: '',
    socialFacebook: '',
    socialTiktok: '',
    weeklyHours: { ...DEFAULT_HOURS }
  }
}

export default function PublicProfileSettingsPage() {
  const router = useRouter()
  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [handle, setHandle] = useState('')
  const [tz, setTz] = useState('UTC')
  const [form, setForm] = useState(() => emptyForm())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef = useRef(null)

  const LOGO_MAX_BYTES = 2 * 1024 * 1024
  const LOGO_ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/webp']

  const patchForm = useCallback((part) => {
    setForm((f) => ({ ...f, ...part }))
    setMessage({ type: '', text: '' })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('book8_token')
    setToken(t)
    if (!t) router.replace('/')
  }, [router])

  useEffect(() => {
    if (!token) return
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load businesses')
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
    })()
  }, [token])

  useEffect(() => {
    if (!token || !selectedBusinessId) return
    ;(async () => {
      setLoading(true)
      setMessage({ type: '', text: '' })
      try {
        const bizRes = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const bizData = await bizRes.json()
        const b = (bizData.businesses || []).find((x) => x.businessId === selectedBusinessId)
        if (b) setBusinessName(b.name || '')

        const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load profile')
        setHandle(data.handle || '')
        setTz(data.timezone || typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC')
        const p = data.businessProfile
        const s = p?.social || {}
        setLogoUrl(typeof p?.logo?.url === 'string' ? p.logo.url : '')
        if (p && typeof p === 'object') {
          setForm({
            street: p.street || '',
            street2: p.street2 || '',
            city: p.city || '',
            provinceState: p.provinceState || '',
            postalCode: p.postalCode || '',
            country: p.country || 'US',
            phone: p.phone || '',
            email: p.email || '',
            description: p.description || '',
            website: p.website || '',
            socialInstagram: s.instagram || '',
            socialFacebook: s.facebook || '',
            socialTiktok: s.tiktok || '',
            weeklyHours:
              p.weeklyHours && typeof p.weeklyHours === 'object'
                ? { ...DEFAULT_HOURS, ...p.weeklyHours }
                : { ...DEFAULT_HOURS }
          })
        } else {
          setLogoUrl('')
          setForm(emptyForm())
        }
      } catch (e) {
        setMessage({ type: 'error', text: e.message || 'Load failed' })
      } finally {
        setLoading(false)
      }
    })()
  }, [token, selectedBusinessId])

  const previewProfile = useMemo(() => {
    const raw = {
      street: form.street,
      street2: form.street2,
      city: form.city,
      provinceState: form.provinceState,
      postalCode: form.postalCode,
      country: form.country,
      phone: form.phone,
      email: form.email,
      description: form.description,
      website: form.website,
      social: {
        instagram: form.socialInstagram,
        facebook: form.socialFacebook,
        tiktok: form.socialTiktok
      },
      weeklyHours: form.weeklyHours,
      ...(logoUrl ? { logo: { url: logoUrl } } : {})
    }
    return sanitizeBusinessProfileForPublic(raw)
  }, [form, logoUrl])

  const uploadLogo = async (fileList) => {
    const file = fileList?.[0]
    if (!file || !token || !selectedBusinessId) return
    if (!LOGO_ACCEPT_TYPES.includes(file.type)) {
      setMessage({ type: 'error', text: 'Use PNG, JPG, or WEBP only.' })
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      setMessage({ type: 'error', text: 'Logo must be 2MB or smaller.' })
      return
    }
    setLogoUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/logo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      const url = data.url || data.logo?.url
      if (!url) throw new Error('No logo URL returned')
      setLogoUrl(url)
      setMessage({ type: 'success', text: 'Logo saved.' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Upload failed' })
    } finally {
      setLogoUploading(false)
    }
  }

  const removeLogo = async () => {
    if (!token || !selectedBusinessId) return
    setLogoUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/logo`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Remove failed')
      setLogoUrl('')
      setMessage({ type: 'success', text: 'Logo removed.' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Remove failed' })
    } finally {
      setLogoUploading(false)
    }
  }

  const save = async () => {
    if (!token || !selectedBusinessId) return
    setSaving(true)
    setMessage({ type: '', text: '' })
    try {
      const body = {
        street: form.street.trim(),
        street2: form.street2.trim(),
        city: form.city.trim(),
        provinceState: form.provinceState.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country,
        phone: form.phone.trim(),
        email: form.email.trim(),
        description: form.description.trim().slice(0, 500),
        website: form.website.trim(),
        social: {
          instagram: form.socialInstagram.trim(),
          facebook: form.socialFacebook.trim(),
          tiktok: form.socialTiktok.trim()
        },
        weeklyHours: form.weeklyHours
      }
      const res = await fetch(`/api/business/${encodeURIComponent(selectedBusinessId)}/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMessage({ type: 'success', text: 'Public profile saved.' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const setDayHours = (day, closed, start, end) => {
    setForm((f) => {
      const next = { ...f.weeklyHours }
      if (closed) next[day] = []
      else next[day] = [{ start: start || '09:00', end: end || '17:00' }]
      return { ...f, weeklyHours: next }
    })
    setMessage({ type: '', text: '' })
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const bookingPreviewUrl =
    typeof window !== 'undefined' && handle ? `${window.location.origin}/b/${handle}` : ''

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-7 w-7" />
            Public booking page
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Information clients see on your booking link. Leave fields blank to hide that block on the public
            page.
          </p>
          {bookingPreviewUrl ? (
            <p className="text-sm mt-2">
              <a
                href={bookingPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Open live booking page
              </a>
            </p>
          ) : null}
        </div>

        {message.text ? (
          <div
            className={`rounded-md border px-4 py-3 text-sm ${
              message.type === 'error'
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Business details</CardTitle>
              <CardDescription>Address, contact, and hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
              ) : businesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <Link href="/dashboard/business" className="text-primary underline">
                    Create a business
                  </Link>{' '}
                  first.
                </p>
              ) : (
                <>
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

                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <Label>Business logo</Label>
                    <p className="text-xs text-muted-foreground">
                  Shown on your public booking page next to your business name. PNG, JPG, or WEBP. Max 2MB.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div
                        className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/40 flex items-center justify-center overflow-hidden shrink-0"
                        aria-hidden={!!logoUrl}
                      >
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImageIcon className="w-10 h-10 text-muted-foreground" aria-hidden />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            uploadLogo(e.target.files)
                            e.target.value = ''
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-fit"
                          disabled={logoUploading}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          {logoUploading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                          Upload logo
                        </Button>
                        {logoUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-fit text-destructive hover:text-destructive"
                            disabled={logoUploading}
                            onClick={removeLogo}
                          >
                            Remove logo
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Street address</Label>
                    <Input
                      className="mt-1"
                      value={form.street}
                      onChange={(e) => patchForm({ street: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Apt / suite</Label>
                    <Input
                      className="mt-1"
                      value={form.street2}
                      onChange={(e) => patchForm({ street2: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input className="mt-1" value={form.city} onChange={(e) => patchForm({ city: e.target.value })} />
                    </div>
                    <div>
                      <Label>Postal code</Label>
                      <Input
                        className="mt-1"
                        value={form.postalCode}
                        onChange={(e) => patchForm({ postalCode: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Country</Label>
                      <Select
                        value={form.country}
                        onValueChange={(v) => patchForm({ country: v, provinceState: '' })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_OPTIONS.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Province / state</Label>
                      {getSubdivisionsForCountry(form.country).length > 0 ? (
                        <Select
                          value={form.provinceState}
                          onValueChange={(v) => patchForm({ provinceState: v })}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {getSubdivisionsForCountry(form.country).map((s) => (
                              <SelectItem key={s.code} value={s.code}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="mt-1"
                          value={form.provinceState}
                          onChange={(e) => patchForm({ provinceState: e.target.value })}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Business phone (shown on booking page)</Label>
                    <Input
                      className="mt-1"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => patchForm({ phone: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Your real business line — not your Book8-AI phone number.
                    </p>
                  </div>
                  <div>
                    <Label>Public email</Label>
                    <Input
                      className="mt-1"
                      type="email"
                      value={form.email}
                      onChange={(e) => patchForm({ email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      className="mt-1"
                      placeholder="https://"
                      value={form.website}
                      onChange={(e) => patchForm({ website: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Short description</Label>
                    <Textarea
                      className="mt-1 min-h-[88px]"
                      maxLength={500}
                      value={form.description}
                      onChange={(e) => patchForm({ description: e.target.value.slice(0, 500) })}
                    />
                    <p className="text-xs text-muted-foreground text-right">{form.description.length}/500</p>
                  </div>

                  <p className="text-sm font-medium">Social (optional)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Instagram</Label>
                      <Input
                        className="mt-1"
                        value={form.socialInstagram}
                        onChange={(e) => patchForm({ socialInstagram: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Facebook</Label>
                      <Input
                        className="mt-1"
                        value={form.socialFacebook}
                        onChange={(e) => patchForm({ socialFacebook: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">TikTok</Label>
                      <Input
                        className="mt-1"
                        value={form.socialTiktok}
                        onChange={(e) => patchForm({ socialTiktok: e.target.value })}
                      />
                    </div>
                  </div>

                  <p className="text-sm font-medium pt-2">Hours (shown on booking page)</p>
                  <div className="space-y-2">
                    {DAYS.map((day) => {
                      const open = (form.weeklyHours[day] || []).length > 0
                      const seg = form.weeklyHours[day]?.[0]
                      return (
                        <div
                          key={day}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-md p-2"
                        >
                          <span className="text-sm w-24 shrink-0">{DAY_LABELS[day]}</span>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={open}
                              onChange={(e) =>
                                setDayHours(day, !e.target.checked, seg?.start, seg?.end)
                              }
                            />
                            Open
                          </label>
                          {open ? (
                            <div className="flex flex-wrap gap-2 items-center">
                              <Select
                                value={seg?.start || '09:00'}
                                onValueChange={(v) => setDayHours(day, false, v, seg?.end || '17:00')}
                              >
                                <SelectTrigger className="w-[100px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {TIME_OPTS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">to</span>
                              <Select
                                value={seg?.end || '17:00'}
                                onValueChange={(v) => setDayHours(day, false, seg?.start || '09:00', v)}
                              >
                                <SelectTrigger className="w-[100px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {TIME_OPTS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
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

                  <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save public profile
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gray-950 text-white border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Preview</CardTitle>
              <CardDescription className="text-gray-400">
                Approximate look on your public booking page (dark theme).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewProfile ? (
                <PublicBusinessInfoPanel
                  businessProfile={previewProfile}
                  businessDisplayName={businessName || 'Your business'}
                  businessTimeZone={tz}
                  t={getBookingTranslations('en')}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  Fill in address, phone, email, description, hours, or social — preview appears when there is
                  something to show.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
