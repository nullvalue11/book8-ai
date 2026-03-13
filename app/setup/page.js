'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Header from '@/components/Header'
import {
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

function SetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [token, setToken] = useState(null)
  const [appReady, setAppReady] = useState(false)

  const [businessId, setBusinessId] = useState(null)
  const [businessName, setBusinessName] = useState('')
  const [assignedTwilioNumber, setAssignedTwilioNumber] = useState(null)
  const [forwardingEnabled, setForwardingEnabled] = useState(false)
  const [forwardingFrom, setForwardingFrom] = useState([])
  const [numberSetupMethod, setNumberSetupMethod] = useState(null)

  const [step, setStep] = useState('choice') // choice | existing | new | confirm | done
  const [phoneInput, setPhoneInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load auth token
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('book8_token')
        if (t) setToken(t)
      }
    } finally {
      setAppReady(true)
    }
  }, [])

  // Redirect if not logged in
  useEffect(() => {
    if (appReady && !token) {
      router.push('/')
    }
  }, [appReady, token, router])

  // Load business + phone setup info
  useEffect(() => {
    const load = async () => {
      if (!token) return

      setLoading(true)
      setError('')

      try {
        const urlBusinessId = searchParams.get('businessId')

        // First, load businesses to find default
        const bizRes = await fetch('/api/business/register', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        const bizData = await bizRes.json()

        if (!bizRes.ok || !bizData.ok) {
          throw new Error(bizData.error || 'Failed to load businesses')
        }

        const businesses = bizData.businesses || []
        if (!businesses.length) {
          setError('You need to register a business first.')
          setLoading(false)
          return
        }

        const primary =
          businesses.find((b) => b.businessId === urlBusinessId) ||
          businesses[0]

        setBusinessId(primary.businessId)
        setBusinessName(primary.name)

        const setupRes = await fetch(
          `/api/business/phone-setup?businessId=${encodeURIComponent(
            primary.businessId
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          }
        )
        const setupData = await setupRes.json()

        if (setupRes.ok && setupData.ok) {
          setAssignedTwilioNumber(setupData.assignedTwilioNumber || null)
          setForwardingEnabled(!!setupData.forwardingEnabled)
          setForwardingFrom(setupData.forwardingFrom || [])
          setNumberSetupMethod(setupData.numberSetupMethod || null)

          if (
            setupData.numberSetupMethod ||
            setupData.forwardingEnabled ||
            setupData.assignedTwilioNumber
          ) {
            setStep('done')
          }
        } else {
          // If core-api read fails, we still allow setup UI
          console.warn(
            '[setup] Failed to load phone setup info',
            setupData?.error
          )
        }
      } catch (err) {
        console.error('[setup] Load error', err)
        setError(err.message || 'Failed to load setup info')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token, searchParams])

  const book8Number =
    assignedTwilioNumber || '+1 (647) 788-0000' // placeholder if not yet assigned

  const book8NumberRaw = (assignedTwilioNumber || '+16477880000').replace(
    /[^\d+]/g,
    ''
  )

  async function saveSetup(method, options = {}) {
    if (!businessId) return
    setSaving(true)
    setError('')

    try {
      const payload = {
        businessId,
        numberSetupMethod: method,
        forwardingEnabled: method === 'forwarding' && options.forwardingEnabled,
        forwardingFrom:
          method === 'forwarding' && options.forwardingFrom
            ? [options.forwardingFrom]
            : [],
        phoneNumber:
          method === 'forwarding' && options.forwardingFrom
            ? options.forwardingFrom
            : null
      }

      const res = await fetch('/api/business/phone-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to save phone setup')
      }

      setNumberSetupMethod(method)
      setForwardingEnabled(payload.forwardingEnabled)
      setForwardingFrom(payload.forwardingFrom)
      setStep('confirm')
    } catch (err) {
      console.error('[setup] Save error', err)
      setError(err.message || 'Failed to save setup')
    } finally {
      setSaving(false)
    }
  }

  if (!appReady || loading) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto max-w-2xl px-6 py-16">
          <p className="text-muted-foreground">Loading setup...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            Step 2 · Activate your booking line
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your phone number
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how customers will reach your Book8 AI assistant for{' '}
            <span className="font-medium">{businessName}</span>.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Step 1: Choice */}
        {step === 'choice' && (
          <div className="space-y-4">
            <Card
              className="border border-border hover:border-primary cursor-pointer transition"
              onClick={() => setStep('existing')}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Use my existing business number
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Keep your current number on your website, Google listing,
                    and business cards. Calls forward to Book8 and are answered
                    by AI.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" size="sm">
                  Select
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card
              className="border border-border hover:border-primary cursor-pointer transition"
              onClick={() => setStep('new')}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Give me a new booking number
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Use a dedicated Book8 phone number as your public booking
                    line. Share it on your website, social, and listings.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" size="sm">
                  Select
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2A: Existing number */}
        {step === 'existing' && (
          <Card className="mt-2">
            <CardHeader>
              <CardTitle className="text-base">
                Use your existing business number
              </CardTitle>
              <CardDescription className="text-xs">
                Customers keep calling your current number. Your carrier
                forwards calls to Book8, and our AI answers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="phone">Your current business phone number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <p className="font-medium text-sm mb-1">
                    Your Book8 AI number
                  </p>
                  <p className="text-lg font-semibold">{book8Number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This is the number your carrier should forward calls to.
                  </p>
                </div>

                <div>
                  <p className="font-medium text-sm mb-2">
                    To activate, set up call forwarding on your phone:
                  </p>
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold">Quick setup (most carriers)</p>
                    <p className="font-mono bg-muted px-2 py-1 rounded inline-block">
                      *72 {book8NumberRaw}
                    </p>
                    <p className="mt-2 font-semibold">
                      Carrier-specific instructions:
                    </p>
                    <ul className="space-y-1">
                      <li>AT&amp;T: Dial *72, then the Book8 number</li>
                      <li>
                        T-Mobile: Dial <span className="font-mono">**21*{book8NumberRaw}#</span> and
                        press call
                      </li>
                      <li>Verizon: Dial *72, then the Book8 number</li>
                      <li>Rogers: Dial *72, then the Book8 number</li>
                      <li>Bell: Dial *72, then the Book8 number</li>
                      <li>Telus: Dial *72, then the Book8 number</li>
                    </ul>
                    <p className="mt-2 text-muted-foreground">
                      Some business/VoIP lines use different codes. Check with
                      your phone provider if the above doesn&apos;t work.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setStep('choice')}
                >
                  <ArrowLeft className="w-3 h-3 mr-2" />
                  Back
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={!phoneInput || saving}
                    onClick={() =>
                      saveSetup('forwarding', {
                        forwardingEnabled: false,
                        forwardingFrom: phoneInput
                      })
                    }
                  >
                    I&apos;ll do this later
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    disabled={!phoneInput || saving}
                    onClick={() =>
                      saveSetup('forwarding', {
                        forwardingEnabled: true,
                        forwardingFrom: phoneInput
                      })
                    }
                  >
                    {saving ? 'Saving...' : "I've set up forwarding"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2B: New number */}
        {step === 'new' && (
          <Card className="mt-2">
            <CardHeader>
              <CardTitle className="text-base">
                Use a new Book8 booking number
              </CardTitle>
              <CardDescription className="text-xs">
                Share this number on your website, social media, and business
                listings. Calls will be answered by your AI booking assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-muted p-3">
                <p className="font-medium text-sm mb-1">
                  Your Book8 booking number
                </p>
                <p className="text-lg font-semibold">{book8Number}</p>
                {!assignedTwilioNumber && (
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;ll finalize and assign this number shortly. You can
                    still complete setup now.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setStep('choice')}
                >
                  <ArrowLeft className="w-3 h-3 mr-2" />
                  Back
                </Button>
                <Button
                  size="sm"
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    saveSetup('direct', {
                      forwardingEnabled: false
                    })
                  }
                >
                  {saving ? 'Saving...' : 'Go to confirmation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <Card className="mt-2">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Your AI booking line is almost ready
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  We&apos;ve saved your phone setup preferences for{' '}
                  <span className="font-medium">{businessName}</span>.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Callers will hear a friendly AI greeting like:
                <br />
                <span className="italic text-muted-foreground">
                  &quot;Hi, thanks for calling {businessName}. How can I help
                  you today?&quot;
                </span>
              </p>
              <p className="text-muted-foreground">
                Your assistant knows your services and hours. Try calling your
                number to test it after forwarding is active or your new number
                is assigned.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setStep('done')}
                >
                  Finish
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 (completed) */}
        {step === 'done' && (
          <Card className="mt-2">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Your AI booking line is active
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  You can adjust phone settings anytime from this page.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span className="text-emerald-600 font-medium">Active</span>
                </p>
                <p>
                  <span className="font-medium">Book8 number:</span>{' '}
                  {book8Number}
                </p>
                {numberSetupMethod === 'forwarding' && forwardingFrom?.length > 0 && (
                  <p>
                    <span className="font-medium">Forwarding from:</span>{' '}
                    {forwardingFrom.join(', ')}
                  </p>
                )}
              </div>

              <p className="text-muted-foreground">
                Try calling your number now to hear your AI assistant in action.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setStep('choice')}
                >
                  Adjust setup
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SetupContent />
    </Suspense>
  )
}

