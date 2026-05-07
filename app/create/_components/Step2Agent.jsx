'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import VoicePicker from './VoicePicker'
import HoursEditor, { defaultHoursForCategory } from './HoursEditor'
import ServicesEditor from './ServicesEditor'

const STEP1_KEY = 'book8.wizard.step1'
const STEP2_KEY = 'book8.wizard.step2'
const PROFILE_STORAGE_KEY = 'book8.wizard.profileFromCreate'

function base64EncodeUtf8(jsonString) {
  return Buffer.from(String(jsonString || ''), 'utf8').toString('base64')
}

function toServiceRows(sampleServices) {
  const arr = Array.isArray(sampleServices) ? sampleServices : []
  const out = []
  for (const s of arr) {
    const name = typeof s?.name === 'string' ? s.name.trim() : ''
    if (!name) continue
    const durationMinutes = Number(s?.durationMinutes) || 30
    const priceEstimate = Number(s?.priceEstimate)
    const priceCents = Number.isFinite(priceEstimate) ? Math.max(0, Math.round(priceEstimate * 100)) : null
    out.push({
      id: `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      durationMinutes,
      priceCents
    })
    if (out.length >= 5) break
  }
  return out
}

function emptyServiceRow() {
  return [
    {
      id: `svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: '',
      durationMinutes: 30,
      priceCents: null
    }
  ]
}

function readStep1(descriptionParam, verticalParam) {
  try {
    const raw = sessionStorage.getItem(STEP1_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || d.v !== 1) return null
    if ((d.descriptionKey || '') !== (descriptionParam || '')) return null
    if ((d.vertical || '') !== (verticalParam || '')) return null
    return d
  } catch {
    return null
  }
}

function isRowValid(r) {
  const nameOk = typeof r?.name === 'string' && r.name.trim().length > 0
  const durationOk = typeof r?.durationMinutes === 'number' && Number.isFinite(r.durationMinutes) && r.durationMinutes > 0
  const priceOk = typeof r?.priceCents === 'number' && Number.isFinite(r.priceCents) && r.priceCents > 0
  return nameOk && durationOk && priceOk
}

export default function Step2Agent({ descriptionParam, verticalParam, onBack, onContinue }) {
  const step1 = useMemo(() => readStep1(descriptionParam, verticalParam), [descriptionParam, verticalParam])
  const step1Form = step1?.form || {}
  const step1Meta = step1?.meta || {}
  const step1Inference = step1?.inference || null

  const defaultVoiceLang = ['en', 'fr', 'es', 'ar'].includes(step1Form.language) ? step1Form.language : 'en'
  const defaultHours = defaultHoursForCategory(step1Form.category)
  const defaultServices = (() => {
    const fromSample = toServiceRows(step1Meta.sampleServices)
    return fromSample.length > 0 ? fromSample : emptyServiceRow()
  })()

  const [voiceLang, setVoiceLang] = useState(defaultVoiceLang)
  const [hours, setHours] = useState(defaultHours)
  const [services, setServices] = useState(defaultServices)
  const [servicesError, setServicesError] = useState('')

  const debounceRef = useRef(null)

  // Load saved Step 2 if present
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STEP2_KEY)
      if (!raw) return
      const d = JSON.parse(raw)
      if (!d || d.v !== 1) return
      if (d.voiceLang) setVoiceLang(d.voiceLang)
      if (d.hours) setHours(d.hours)
      if (Array.isArray(d.services)) setServices(d.services)
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist Step 2 (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      try {
        sessionStorage.setItem(
          STEP2_KEY,
          JSON.stringify({
            v: 1,
            voiceLang,
            hours,
            services,
            savedAt: new Date().toISOString()
          })
        )
      } catch {
        /* ignore */
      }
    }, 300)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [voiceLang, hours, services])

  const onContinueClick = () => {
    setServicesError('')
    const cleaned = Array.isArray(services) ? services : []
    if (cleaned.length === 0) {
      setServicesError('Add at least one service to continue.')
      return
    }
    const invalid = cleaned.some((r) => !isRowValid(r))
    if (invalid) {
      setServicesError('Each service needs a name, duration, and price.')
      return
    }

    const step2 = {
      v: 1,
      voiceLang,
      hours,
      services: cleaned.map((r) => ({
        name: String(r.name || '').trim(),
        durationMinutes: Number(r.durationMinutes) || 30,
        priceCents: Math.max(0, Math.round(Number(r.priceCents) || 0))
      })),
      savedAt: new Date().toISOString()
    }

    try {
      sessionStorage.setItem(STEP2_KEY, JSON.stringify(step2))
    } catch {
      /* ignore */
    }

    const step1Payload = {
      businessName: String(step1Form.businessName || '').trim(),
      category: step1Form.category || 'other',
      description: String(step1Form.description || '').trim(),
      country: step1Form.countryLabel || 'United States',
      timezone: step1Form.timezone || 'America/New_York',
      language: step1Form.language || 'en',
      websiteUrl: String(step1Form.websiteUrl || '').trim(),
      address: String(step1Form.address || '').trim() || null,
      sampleServices: step1Meta.sampleServices || [],
      _confidence: step1Meta._confidence || {}
    }

    const combined = {
      step1: step1Payload,
      step2,
      _inference: step1Inference
    }

    const encoded = base64EncodeUtf8(JSON.stringify(combined))
    try {
      sessionStorage.setItem(PROFILE_STORAGE_KEY, encoded)
    } catch {
      /* ignore */
    }

    onContinue?.(encoded)
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Customize your AI agent</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          Set the voice, hours, and services your AI will use. You can change these anytime later.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Voice</h3>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Choose how your receptionist sounds. (Audio previews coming soon.)
        </p>
        <div className="mt-5">
          <VoicePicker value={voiceLang} onChange={setVoiceLang} defaultLang={defaultVoiceLang} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Hours</h3>
        <p className="mt-1 text-sm text-[#94A3B8]">Your AI will only book appointments during open hours.</p>
        <div className="mt-5">
          <HoursEditor value={hours} onChange={setHours} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h3 className="text-lg font-semibold text-white">Services</h3>
        <p className="mt-1 text-sm text-[#94A3B8]">
          Add what customers can book. At least one service is required.
        </p>
        <div className="mt-5">
          <ServicesEditor value={services} onChange={setServices} error={servicesError} />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl border-white/15 bg-transparent text-white hover:bg-white/5"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <p className="text-xs text-[#64748B] text-center sm:text-left">
          Step 3 of 7: Save your progress with a free account
        </p>
        <Button
          type="button"
          onClick={onContinueClick}
          className="h-12 rounded-xl bg-[#8B5CF6] px-8 text-base font-semibold text-white hover:bg-[#7C3AED]"
        >
          Continue →
        </Button>
      </div>
    </div>
  )
}

