'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { PRIMARY_LANGUAGE_OPTIONS } from '@/lib/primary-languages'
import { getOrderedTimeZoneIds, timeZoneLabel } from '@/lib/timezones'
import ThemeToggle from '@/components/ThemeToggle'

const STORAGE_KEY = 'book8.wizard.step1'

const CATEGORY_OPTIONS = [
  { value: 'barber', label: 'Barbershop' },
  { value: 'dental', label: 'Dental Clinic' },
  { value: 'spa', label: 'Spa & Beauty' },
  { value: 'fitness', label: 'Fitness Studio' },
  { value: 'physio', label: 'Physio Clinic' },
  { value: 'other', label: 'Other' }
]

const WIZARD_STEPS = [
  { title: 'Business profile', short: 'Profile' },
  { title: 'Agent customization', short: 'Agent' },
  { title: 'Account setup', short: 'Account' },
  { title: 'Capabilities', short: 'Skills' },
  { title: 'Test your AI', short: 'Test' },
  { title: 'Phone line', short: 'Phone' },
  { title: 'Review & launch', short: 'Launch' }
]

const WIZARD_LANG_OPTIONS = PRIMARY_LANGUAGE_OPTIONS.filter((o) =>
  ['en', 'fr', 'es', 'ar'].includes(o.code)
)

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

function matchCountryLabel(inferred) {
  const t = (inferred || '').trim()
  if (!t) return 'United States'
  const hit = COUNTRY_OPTIONS.find((c) => c.label.toLowerCase() === t.toLowerCase())
  return hit?.label ?? 'United States'
}

function profileToFormState(profile) {
  const cat = CATEGORY_OPTIONS.some((c) => c.value === profile?.category)
    ? profile.category
    : 'other'
  return {
    businessName: profile?.businessName || '',
    category: cat,
    description: profile?.description || '',
    countryLabel: matchCountryLabel(profile?.country),
    timezone:
      typeof profile?.timezone === 'string' && profile.timezone.trim()
        ? profile.timezone.trim()
        : 'America/New_York',
    language: ['en', 'fr', 'es', 'ar'].includes(profile?.language) ? profile.language : 'en',
    websiteUrl: profile?.websiteUrl || '',
    address: profile?.address === null || profile?.address === undefined ? '' : String(profile.address)
  }
}

export default function CreateWizardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const descriptionParam = (searchParams.get('description') || '').trim()
  const verticalParam = (searchParams.get('vertical') || '').trim()

  const [phase, setPhase] = useState('loading')
  const [form, setForm] = useState(() => profileToFormState({}))
  const [meta, setMeta] = useState({
    sampleServices: [],
    _confidence: { businessName: 'low', address: 'low', category: 'medium' }
  })

  const timezoneIds = useMemo(() => {
    try {
      return getOrderedTimeZoneIds()
    } catch {
      return ['America/New_York', 'UTC']
    }
  }, [])

  const addressPlaceholder =
    meta._confidence?.address === 'low' ? '(please confirm)' : 'Street, city, region'

  const applyProfile = useCallback((profile) => {
    setForm(profileToFormState(profile))
    setMeta({
      sampleServices: Array.isArray(profile?.sampleServices) ? profile.sampleServices : [],
      _confidence:
        profile?._confidence && typeof profile._confidence === 'object'
          ? {
              businessName: profile._confidence.businessName || 'low',
              address: profile._confidence.address || 'low',
              category: profile._confidence.category || 'medium'
            }
          : { businessName: 'low', address: 'low', category: 'medium' }
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          if (
            saved &&
            saved.v === 1 &&
            saved.descriptionKey === descriptionParam &&
            saved.vertical === verticalParam &&
            saved.form
          ) {
            if (cancelled) return
            setForm(saved.form)
            if (saved.meta) setMeta(saved.meta)
            setPhase('ready')
            return
          }
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return
      setPhase('loading')

      try {
        const res = await fetch('/api/wizard/infer-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: descriptionParam,
            ...(verticalParam ? { vertical: verticalParam } : {})
          })
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        const profile = data?.profile && typeof data.profile === 'object' ? data.profile : {}
        applyProfile(profile)
      } catch (e) {
        console.warn('[create] infer-profile failed', e?.message || e)
        if (!cancelled) applyProfile({})
      } finally {
        if (!cancelled) setPhase('ready')
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [descriptionParam, verticalParam, applyProfile])

  useEffect(() => {
    if (phase !== 'ready') return
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: 1,
          descriptionKey: descriptionParam,
          vertical: verticalParam,
          form,
          meta
        })
      )
    } catch {
      /* ignore */
    }
  }, [phase, descriptionParam, verticalParam, form, meta])

  const onContinue = () => {
    if (!form.businessName.trim()) return
    const country = form.countryLabel
    const payload = {
      businessName: form.businessName.trim(),
      category: form.category,
      description: form.description.trim(),
      country,
      timezone: form.timezone,
      language: form.language,
      websiteUrl: form.websiteUrl.trim(),
      address: form.address.trim() || null,
      sampleServices: meta.sampleServices,
      _confidence: meta._confidence
    }
    const b64 = utf8ToBase64(JSON.stringify(payload))
    router.push(`/signup?profileData=${encodeURIComponent(b64)}`)
  }

  const tzValue = timezoneIds.includes(form.timezone) ? form.timezone : form.timezone

  return (
    <div className="min-h-dvh bg-[#0A0A0F] text-slate-100">
      <header className="border-b border-white/10 bg-[#0A0A0F]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image
              src="/brand/book8_ai_logo.svg"
              alt="Book8"
              width={120}
              height={32}
              className="h-8 w-auto dark:brightness-0 dark:invert"
              priority
            />
          </Link>
          <ThemeToggle variant="landing" className="shrink-0" />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:gap-12">
        <aside className="lg:w-72 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
            Step 1 of 7
          </p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">Business profile</h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            We&apos;ll infer details from your link—you can edit everything before continuing.
          </p>
          <nav className="mt-8 space-y-2" aria-label="Wizard steps">
            {WIZARD_STEPS.map((s, i) => {
              const n = i + 1
              const current = n === 1
              return (
                <div
                  key={s.title}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    current
                      ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-white'
                      : 'border-white/5 bg-white/[0.02] text-[#64748B]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                        current ? 'bg-[#8B5CF6] text-white' : 'bg-[#1e293b] text-[#64748B]'
                      )}
                    >
                      {n}
                    </span>
                    <span className="font-medium">{s.short}</span>
                  </div>
                  <p className="mt-1 pl-8 text-xs text-[#64748B]">{s.title}</p>
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {phase === 'loading' ? (
            <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
              <div className="mb-6 space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-full max-w-md animate-pulse rounded bg-white/5" />
              </div>
              <p className="text-sm font-medium text-[#A78BFA]">Inferring your business profile…</p>
              <p className="mt-1 text-xs text-[#64748B]">This usually takes a few seconds.</p>
              <div className="mt-8 space-y-6">
                {[1, 2, 3, 4, 5].map((k) => (
                  <div key={k} className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                    <div className="h-11 w-full animate-pulse rounded-xl bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bname" className="text-[#E2E8F0]">
                    Business name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="bname"
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
                    placeholder="Your business name"
                    autoComplete="organization"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#E2E8F0]">Business type</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger className="h-11 border-white/10 bg-[#0A0A0F] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)] border-white/10 bg-[#121228] text-white">
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bdesc" className="text-[#E2E8F0]">
                    Description
                  </Label>
                  <Textarea
                    id="bdesc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
                    placeholder="Short summary of what you offer (optional)"
                  />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[#E2E8F0]">Country</Label>
                    <Select
                      value={form.countryLabel}
                      onValueChange={(v) => setForm((f) => ({ ...f, countryLabel: v }))}
                    >
                      <SelectTrigger className="h-11 border-white/10 bg-[#0A0A0F] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(24rem,70vh)] overflow-y-auto border-white/10 bg-[#121228] text-white">
                        {COUNTRY_OPTIONS.map((c) => (
                          <SelectItem key={c.code} value={c.label}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[#E2E8F0]">Timezone</Label>
                    <Select
                      value={tzValue}
                      onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
                    >
                      <SelectTrigger className="h-11 border-white/10 bg-[#0A0A0F] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(24rem,70vh)] overflow-y-auto border-white/10 bg-[#121228] text-white">
                        {!timezoneIds.includes(form.timezone) && form.timezone ? (
                          <SelectItem value={form.timezone}>{timeZoneLabel(form.timezone)}</SelectItem>
                        ) : null}
                        {timezoneIds.map((z) => (
                          <SelectItem key={z} value={z}>
                            {timeZoneLabel(z)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#E2E8F0]">Main language</Label>
                  <Select
                    value={form.language}
                    onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}
                  >
                    <SelectTrigger className="h-11 border-white/10 bg-[#0A0A0F] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#121228] text-white">
                      {WIZARD_LANG_OPTIONS.map((o) => (
                        <SelectItem key={o.code} value={o.code}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bweb" className="text-[#E2E8F0]">
                    Website URL
                  </Label>
                  <Input
                    id="bweb"
                    value={form.websiteUrl}
                    onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                    className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
                    placeholder="https://"
                    inputMode="url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baddr" className="text-[#E2E8F0]">
                    Address
                  </Label>
                  <Input
                    id="baddr"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    className="h-11 border-white/10 bg-[#0A0A0F] text-white placeholder:text-[#64748B]"
                    placeholder={addressPlaceholder}
                  />
                </div>
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#64748B]">
                  Next you&apos;ll create an account to save this progress.
                </p>
                <Button
                  type="button"
                  disabled={!form.businessName.trim()}
                  onClick={onContinue}
                  className="h-12 rounded-xl bg-[#8B5CF6] px-8 text-base font-semibold text-white hover:bg-[#7C3AED] disabled:opacity-40"
                >
                  Continue →
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
