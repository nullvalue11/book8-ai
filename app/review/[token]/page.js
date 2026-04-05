'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { getBookingTranslations } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'

export default function ClientReviewPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''

  const [loadState, setLoadState] = useState('loading')
  const [lang, setLang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const [businessName, setBusinessName] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [serviceName, setServiceName] = useState('')
  const [appointmentLabel, setAppointmentLabel] = useState('')
  const [customerName, setCustomerName] = useState('')

  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [doneName, setDoneName] = useState('')

  const t = useMemo(() => getBookingTranslations(lang), [lang])

  const load = useCallback(async () => {
      if (!token) {
        setLoadState('invalid')
        return
      }
    setLoadState('loading')
    try {
      const res = await fetch(`/api/reviews?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!data.ok) {
        setLoadState('invalid')
        return
      }
      if ( data.lang && ['en', 'fr', 'es', 'ar'].includes(data.lang)) {
        setLang(data.lang)
      }
      if (data.state === 'expired') {
        setLoadState('expired')
        return
      }
      if (data.state === 'invalid') {
        setLoadState('invalid')
        return
      }
      if (data.state === 'already_reviewed') {
        if (data.lang && ['en', 'fr', 'es', 'ar'].includes(data.lang)) setLang(data.lang)
        setLoadState('already_reviewed')
        return
      }
      if (data.state === 'ready') {
        setBusinessName(data.businessName || '')
        setLogoUrl(data.logoUrl || null)
        setServiceName(data.serviceName || '')
        setAppointmentLabel(data.appointmentLabel || '')
        setCustomerName(data.customerName || '')
        setLoadState('ready')
        return
      }
      setLoadState('invalid')
    } catch {
      setLoadState('invalid')
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const rv = t.reviews

  const submit = async () => {
    if (!token || rating < 1) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, comment: comment.slice(0, 500) })
      })
      const data = await res.json()
      if (res.status === 409) {
        setLoadState('already_reviewed')
        return
      }
      if (!res.ok) {
        if (res.status === 410) {
          setLoadState('expired')
          return
        }
        setSubmitError(data.error || rv.submitError || 'Failed')
        return
      }
      if (data.ok) {
        setDoneName(data.businessName || businessName)
        setLoadState('thank_you')
      }
    } catch {
      setSubmitError(rv.submitError || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  if (loadState === 'loading') {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center" dir={dir}>
        <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
      </main>
    )
  }

  if (loadState === 'expired') {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6" dir={dir}>
        <p className="text-center text-lg text-gray-300">{rv.expired}</p>
      </main>
    )
  }

  if (loadState === 'invalid') {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6" dir={dir}>
        <p className="text-center text-lg text-gray-300">{rv.invalidLink}</p>
      </main>
    )
  }

  if (loadState === 'already_reviewed') {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6" dir={dir}>
        <p className="text-center text-lg text-gray-300">{rv.alreadyReviewed}</p>
      </main>
    )
  }

  if (loadState === 'thank_you') {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 gap-4" dir={dir}>
        <p className="text-xl font-semibold text-center">{rv.thankYou}</p>
        <p className="text-gray-400 text-center">{doneName}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10 md:py-16" dir={dir} lang={lang}>
      <div className="max-w-lg mx-auto space-y-8">
        <header className="flex flex-col items-center text-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-700" />
          ) : null}
          <h1 className="text-2xl font-bold">{businessName}</h1>
          <p className="text-gray-400 text-sm">
            {rv.leaveReview}
          </p>
          {(serviceName || appointmentLabel) ? (
            <div className="text-sm text-gray-500 space-y-1">
              {serviceName ? <p>{serviceName}</p> : null}
              {appointmentLabel ? <p>{appointmentLabel}</p> : null}
            </div>
          ) : null}
        </header>

        <div className="space-y-2">
          <p className="text-sm font-medium text-center">{rv.howWasYour}</p>
          <p className="text-xs text-gray-500 text-center">{rv.tapToRate}</p>
          <div className="flex justify-center gap-2 sm:gap-3 py-2" role="group" aria-label={rv.tapToRate}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`min-h-[48px] min-w-[48px] rounded-xl text-3xl leading-none transition-transform active:scale-95 ${
                  rating >= n ? 'text-yellow-400 scale-105' : 'text-gray-600 hover:text-gray-400'
                }`}
                aria-pressed={rating === n}
                aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-300 block" htmlFor="rv-comment">
            {rv.commentLabel || 'Comment'}
          </label>
          <Textarea
            id="rv-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder={rv.commentPlaceholder}
            className="min-h-[120px] bg-gray-900 border-gray-700 text-white placeholder:text-gray-600"
            maxLength={500}
          />
          <p className="text-xs text-gray-600 text-end">{comment.length}/500</p>
        </div>

        {customerName ? (
          <p className="text-xs text-gray-500 text-center">
            {rv.bookedAs} {customerName}
          </p>
        ) : null}

        {submitError ? (
          <p className="text-sm text-red-400 text-center">{submitError}</p>
        ) : null}

        <Button
          type="button"
          className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700"
          disabled={rating < 1 || submitting}
          onClick={submit}
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : rv.submit}
        </Button>
      </div>
    </main>
  )
}
