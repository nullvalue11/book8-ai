'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { COUNTRY_OPTIONS } from '@/lib/countries'
import { detectWizardCountry, WIZARD_PRICING_COUNTRY_SESSION_KEY } from '@/lib/detectWizardCountry'

export const WIZARD_STEP0_STORAGE_KEY = 'book8.wizard.step0'

export default function Step0Country({ searchParams, acceptLanguageHint, onContinue }) {
  const detected = useMemo(
    () => detectWizardCountry(searchParams, { acceptLanguage: acceptLanguageHint }),
    [searchParams, acceptLanguageHint]
  )
  const [countryCode, setCountryCode] = useState(detected)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCountryCode(detected)
  }, [detected])

  async function handleContinue() {
    setError('')
    setLoading(true)
    try {
      const apiCountry = countryCode === 'OTHER' ? 'CA' : countryCode
      const res = await fetch(
        `/api/business/channels?country=${encodeURIComponent(apiCountry)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok || !data.channels) {
        throw new Error(data.error || 'Could not load channels for your region')
      }
      const resolvedCode =
        countryCode === 'OTHER'
          ? 'CA'
          : String(data.country || apiCountry).toUpperCase().slice(0, 2)
      const payload = {
        profileCountry: resolvedCode,
        channels: data.channels
      }
      try {
        sessionStorage.setItem(
          WIZARD_STEP0_STORAGE_KEY,
          JSON.stringify({ v: 1, ...payload })
        )
        sessionStorage.setItem(WIZARD_PRICING_COUNTRY_SESSION_KEY, payload.profileCountry)
      } catch {
        /* ignore */
      }
      onContinue(payload)
    } catch (e) {
      setError(e.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Where is your business based?</h2>
        <p className="mt-2 text-sm text-[#94A3B8]">
          We&apos;ll set up the right communication channels for your region.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#121228]/60 p-6 sm:p-8 space-y-4">
        <div>
          <Label className="text-[#E2E8F0]">Country / region</Label>
          <Select value={countryCode} onValueChange={setCountryCode}>
            <SelectTrigger className="mt-2 h-12 rounded-xl border-white/15 bg-[#0A0A0F] text-white">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(24rem,60vh)]">
              {COUNTRY_OPTIONS.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button
          type="button"
          onClick={handleContinue}
          disabled={loading || !countryCode}
          className="h-12 w-full rounded-xl bg-[#8B5CF6] text-base font-semibold text-white hover:bg-[#7C3AED] sm:w-auto sm:px-10"
        >
          {loading ? 'Loading…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
