"use client"
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Loader2, AlertCircle, CheckCircle, XCircle, Calendar, Clock } from 'lucide-react'
import { useBookingLanguage } from '@/hooks/useBookingLanguage'
import { trFormat } from '@/lib/translations'

export default function CancelBookingPage({ params }) {
  const { t, language } = useBookingLanguage()
  const nos = t.noShow
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const [cancelFee, setCancelFee] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const token = params.token

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await fetch(`/api/public/bookings/cancel/verify?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Invalid or expired cancellation link')
          setStatus('error')
          return
        }

        setBooking(data.booking)
        try {
          const feeRes = await fetch(
            `/api/public/bookings/cancellation-info?token=${encodeURIComponent(token)}`
          )
          const feeData = await feeRes.json()
          if (feeRes.ok && feeData.ok) {
            setCancelFee(feeData)
          }
        } catch {
          setCancelFee(null)
        }
        setStatus('confirm')
      } catch (err) {
        console.error('Fetch booking error:', err)
        setError('Failed to load booking details. Please try again.')
        setStatus('error')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchBooking()
    } else {
      setError('Invalid cancellation link')
      setStatus('error')
      setLoading(false)
    }
  }, [token])

  async function handleCancel(acceptLateCancellationFee) {
    try {
      setCanceling(true)
      setError('')

      const res = await fetch(`/api/public/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, acceptLateCancellationFee: !!acceptLateCancellationFee })
      })

      const data = await res.json()

      if (res.status === 402 && data.code === 'LATE_CANCEL_FEE_REQUIRED') {
        setError(data.error || nos.cancelFeeTitle)
        setCancelFee((prev) => ({
          ...(prev || {}),
          feeApplies: true,
          feeDisplay: prev?.feeDisplay || null,
          feeCents: data.feeCents,
          currency: data.currency || prev?.currency || 'cad'
        }))
        return
      }

      if (!res.ok) {
        setError(data.error || 'Failed to cancel booking. Please try again.')
        return
      }

      setStatus('success')
    } catch (err) {
      console.error('Cancel error:', err)
      setError('Failed to cancel booking. Please try again.')
    } finally {
      setCanceling(false)
    }
  }

  function formatDateTime(isoString, timezone = 'UTC') {
    return new Date(isoString).toLocaleString(
      language === 'ar' ? 'ar' : undefined,
      {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone
      }
    )
  }

  const feeApplies = !!cancelFee?.feeApplies && (cancelFee?.feeCents > 0 || cancelFee?.feeDisplay)
  const hoursStr = String(cancelFee?.policy?.cancellationWindowHours || '')
  const feeAmt =
    cancelFee?.feeDisplay ||
    (cancelFee?.feeCents != null
      ? new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: String(cancelFee?.currency || 'cad').toUpperCase()
        }).format(cancelFee.feeCents / 100)
      : '')
  const last4 = cancelFee?.last4 || ''

  if (loading) {
    return (
      <main
        lang={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6"
      >
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 flex flex-col items-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading booking details...</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main
        lang={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6"
      >
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Unable to Cancel</h1>
              <p className="text-muted-foreground">{error}</p>
            </div>

            <Button onClick={() => (window.location.href = '/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (status === 'success') {
    return (
      <main
        lang={language}
        dir={language === 'ar' ? 'rtl' : 'ltr'}
        className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6"
      >
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-12 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Meeting Canceled</h1>
              <p className="text-muted-foreground">
                Your meeting has been successfully canceled.
              </p>
              <p className="text-sm text-muted-foreground">
                A cancellation notification has been sent to both you and the host.
              </p>
            </div>

            <Button onClick={() => (window.location.href = '/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main
      lang={language}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6"
    >
      <Card className="max-w-2xl w-full shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
          <CardTitle className="text-2xl">Cancel This Meeting?</CardTitle>
          <CardDescription>
            Are you sure you want to cancel this meeting? This action cannot be undone.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {feeApplies ? (
            <div
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2 text-sm"
              role="alert"
            >
              <p className="font-semibold text-amber-900 dark:text-amber-100">{nos.cancelFeeTitle}</p>
              <p className="text-amber-950/90 dark:text-amber-50/90">
                {trFormat(nos.cancelFeeWarning, { hours: hoursStr, amount: feeAmt })}
              </p>
              {last4 ? (
                <p className="text-amber-950/90 dark:text-amber-50/90">
                  {trFormat(nos.cancelFeeCard, { last4 })}
                </p>
              ) : null}
            </div>
          ) : null}

          {booking && (
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg">Meeting Details</h3>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{booking.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDateTime(booking.startTime, booking.guestTimezone || booking.timeZone)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">Duration</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(booking.startTime).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: booking.guestTimezone || booking.timeZone
                    })}{' '}
                    -{' '}
                    {new Date(booking.endTime).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: booking.guestTimezone || booking.timeZone
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {booking.guestTimezone || booking.timeZone}
                  </p>
                </div>
              </div>

              {booking.notes && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm font-medium mb-2">Notes:</p>
                  <p className="text-sm text-muted-foreground">{booking.notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
              className="flex-1"
              disabled={canceling}
            >
              {nos.keepBooking}
            </Button>

            {feeApplies ? (
              <Button
                onClick={() => handleCancel(true)}
                variant="destructive"
                className="flex-1"
                disabled={canceling}
              >
                {canceling ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  trFormat(nos.cancelAnyway, { amount: feeAmt })
                )}
              </Button>
            ) : (
              <Button onClick={() => handleCancel(false)} variant="destructive" className="flex-1" disabled={canceling}>
                {canceling ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Yes, Cancel Meeting'
                )}
              </Button>
            )}
          </div>

          {error ? <p className="text-sm text-destructive text-center">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  )
}
