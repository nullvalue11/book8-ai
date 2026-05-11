'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { PRIMARY_LANGUAGE_OPTIONS } from '@/lib/primary-languages'
import { getOrderedTimeZoneIds, timeZoneLabel } from '@/lib/timezones'
import { WIZARD_STEP0_STORAGE_KEY } from './Step0Country'

const STORAGE_KEY = 'book8.wizard.step1'

const CATEGORY_OPTIONS = [
  { value: 'barber', label: 'Barbershop' },
  { value: 'dental', label: 'Dental Clinic' },
  { value: 'spa', label: 'Spa & Beauty' },
  { value: 'fitness', label: 'Fitness Studio' },
  { value: 'physio', label: 'Physio Clinic' },
  { value: 'other', label: 'Other' }
]

const WIZARD_LANG_OPTIONS = PRIMARY_LANGUAGE_OPTIONS.filter((o) =>
  ['en', 'fr', 'es', 'ar'].includes(o.code)
)

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
    address:
      profile?.address === null || profile?.address === undefined ? '' : String(profile.address)
  }
}

export default function Step1Profile({ descriptionParam, verticalParam, onContinue }) {
  const step0CountryMergedRef = useRef(false)
  const [phase, setPhase] = useState('loading')
  const [form, setForm] = useState(() => profileToFormState({}))
  const [meta, setMeta] = useState({
    sampleServices: [],
    _confidence: { businessName: 'low', address: 'low', category: 'medium' }
  })
  const [inference, setInference] = useState(null)

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
    setInference(profile && typeof profile === 'object' ? profile : null)
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
            if (saved.inference) setInference(saved.inference)
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
        console.warn('[create/step1] infer-profile failed', e?.message || e)
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
    if (phase !== 'ready' || step0CountryMergedRef.current) return
    try {
      const s0 = sessionStorage.getItem(WIZARD_STEP0_STORAGE_KEY)
      if (!s0) return
      const j = JSON.parse(s0)
      if (j.v !== 1 || !j.profileCountry) return
      const hit = COUNTRY_OPTIONS.find((c) => c.code === j.profileCountry)
      if (!hit) return
      step0CountryMergedRef.current = true
      setForm((prev) => ({ ...prev, countryLabel: hit.label }))
    } catch {
      /* ignore */
    }
  }, [phase])

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
          meta,
          inference
        })
      )
    } catch {
      /* ignore */
    }
  }, [phase, descriptionParam, verticalParam, form, meta, inference])

  return phase === 'loading' ? (
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
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
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
              value={form.timezone}
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
          <Select value={form.language} onValueChange={(v) => setForm((f) => ({ ...f, language: v }))}>
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
        <p className="text-xs text-[#64748B]">Next you&apos;ll customize your agent.</p>
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
  )
}

