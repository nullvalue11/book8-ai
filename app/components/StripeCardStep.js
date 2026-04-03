'use client'

import React, { useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { trFormat } from '@/lib/translations'

const CARD_OPTIONS = {
  style: {
    base: {
      color: '#e2e8f0',
      fontFamily: 'inherit',
      fontSize: '16px',
      '::placeholder': { color: '#64748b' }
    },
    invalid: { color: '#ef4444' }
  }
}

function InnerCardStep({
  handle,
  email,
  name,
  guestTz,
  language,
  t,
  noShowProtection,
  feeDisplay,
  onSuccess,
  onBack,
  disabled
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nos = t.noShow

  async function submit() {
    if (!stripe || !elements || disabled) return
    setError('')
    setBusy(true)
    try {
      const cr = await fetch('/api/public/bookings/setup-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, email, name: name || undefined })
      })
      const cd = await cr.json()
      if (!cr.ok) {
        setError(cd.error || nos.cardError)
        return
      }
      const { clientSecret, setupIntentId: siid } = cd
      if (!clientSecret || !siid) {
        setError(nos.cardError)
        return
      }

      const cardEl = elements.getElement(CardElement)
      const { error: cErr, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl, billing_details: { email, name: name || undefined } }
      })
      if (cErr) {
        setError(cErr.message || nos.cardError)
        return
      }
      if (setupIntent?.status !== 'succeeded') {
        setError(nos.cardError)
        return
      }
      onSuccess({ setupIntentId: siid })
    } catch (e) {
      console.error('[StripeCardStep]', e)
      setError(nos.cardError)
    } finally {
      setBusy(false)
    }
  }

  const policyLine = useMemo(() => {
    if (!noShowProtection?.enabled) return ''
    return trFormat(nos.cancellationPolicy, {
      hours: String(noShowProtection.cancellationWindowHours),
      amount: feeDisplay || '—'
    })
  }, [noShowProtection, feeDisplay, nos])

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700 bg-gray-900/80 p-4 space-y-2">
        <p className="text-sm font-medium text-white">{nos.cardRequired}</p>
        <p className="text-sm text-gray-400">{nos.notChargedNow}</p>
        {policyLine ? <p className="text-sm text-amber-200/90">{policyLine}</p> : null}
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-950 p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">{nos.cardOnFile}</p>
        <div className="py-2 min-h-[44px]">
          <CardElement options={CARD_OPTIONS} />
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex flex-col sm:flex-row gap-3">
        {onBack ? (
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 text-gray-200"
            disabled={busy}
            onClick={onBack}
          >
            {t.back}
          </Button>
        ) : null}
        <Button
          type="button"
          className="flex-1 bg-violet-600 hover:bg-violet-500"
          disabled={!stripe || busy || disabled}
          onClick={submit}
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              {nos.processingCard}
            </>
          ) : (
            t.confirmBooking
          )}
        </Button>
      </div>
    </div>
  )
}

export default function StripeCardStep(props) {
  const { publishableKey, noShowProtection } = props
  const nos = props.t.noShow

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null
    return loadStripe(publishableKey)
  }, [publishableKey])

  if (!publishableKey || !stripePromise) {
    return (
      <p className="text-sm text-amber-400">
        {nos.cardError}
      </p>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <InnerCardStep {...props} />
    </Elements>
  )
}
