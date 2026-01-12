'use client'

/**
 * Business Management Page
 * 
 * Allows users to:
 * - Register a new business
 * - View existing businesses
 * - Subscribe to a plan
 * - Connect Google Calendar
 */

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import Header from '@/components/Header'
import HeaderLogo from '@/components/HeaderLogo'
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  AlertTriangle,
  ClipboardList,
  Rocket,
  RefreshCw,
  CreditCard,
  Calendar,
  ExternalLink,
  Check
} from 'lucide-react'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  provisioning: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  needs_attention: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800'
}

const SUBSCRIPTION_COLORS = {
  none: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  trialing: 'bg-blue-100 text-blue-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-800'
}

// Main content component that uses useSearchParams
function BusinessPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Auth state
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [appReady, setAppReady] = useState(false)
  
  // Business state
  const [businesses, setBusinesses] = useState([])
  const [loadingBusinesses, setLoadingBusinesses] = useState(true)
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  
  // Form state
  const [businessName, setBusinessName] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [autoGenerateId, setAutoGenerateId] = useState(true)
  const [skipVoiceTest, setSkipVoiceTest] = useState(false)
  const [skipBillingCheck, setSkipBillingCheck] = useState(false)
  
  // Workflow state
  const [step, setStep] = useState('list') // 'list' | 'form' | 'plan' | 'confirming' | 'result'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [result, setResult] = useState(null)
  const [currentBusinessId, setCurrentBusinessId] = useState(null)
  
  // Action states
  const [subscribing, setSubscribing] = useState(null)
  const [connectingCalendar, setConnectingCalendar] = useState(null)
  
  // Check for checkout success/cancel and google calendar connection
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout')
    const checkoutBusinessId = searchParams.get('businessId')
    const googleConnected = searchParams.get('google_connected')
    
    if ((checkoutStatus === 'success' && checkoutBusinessId) || googleConnected === '1') {
      // Refresh businesses to show updated status
      if (token) {
        fetchBusinesses()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token])
  
  // Load auth on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('book8_token')
        const u = localStorage.getItem('book8_user')
        if (t) setToken(t)
        if (u) setUser(JSON.parse(u))
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
  
  // Load businesses
  useEffect(() => {
    if (token) {
      fetchBusinesses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  
  async function fetchBusinesses() {
    setLoadingBusinesses(true)
    try {
      const res = await fetch('/api/business/register', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.ok) {
        setBusinesses(data.businesses || [])
      }
    } catch (err) {
      console.error('Failed to fetch businesses:', err)
    } finally {
      setLoadingBusinesses(false)
    }
  }
  
  async function handlePlanSetup(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const body = {
        name: businessName.trim(),
        skipVoiceTest,
        skipBillingCheck
      }
      
      if (!autoGenerateId && businessId.trim()) {
        body.businessId = businessId.trim()
      }
      
      const res = await fetch('/api/business/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.errors?.join(', ') || 'Failed to generate plan')
      }
      
      setPlan(data.plan)
      setCurrentBusinessId(data.businessId)
      setStep('plan')
      fetchBusinesses()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  async function handleConfirm() {
    setLoading(true)
    setError(null)
    setStep('confirming')
    
    try {
      const res = await fetch('/api/business/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: currentBusinessId })
      })
      
      const data = await res.json()
      setResult(data)
      setStep('result')
      fetchBusinesses()
      
    } catch (err) {
      setError(err.message)
      setStep('plan')
    } finally {
      setLoading(false)
    }
  }
  
  async function handleSubscribe(biz) {
    setSubscribing(biz.businessId)
    setError(null)
    
    const endpoint = `/api/business/${biz.businessId}/billing/checkout`
    console.log('[Subscribe] Starting checkout for business:', biz.businessId)
    console.log('[Subscribe] Endpoint:', endpoint)
    console.log('[Subscribe] Token present:', !!token)
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      })
      
      console.log('[Subscribe] Response status:', res.status)
      console.log('[Subscribe] Response statusText:', res.statusText)
      
      // Read response body
      const text = await res.text()
      console.log('[Subscribe] Response body:', text.substring(0, 500))
      
      // Try to parse as JSON
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError) {
        console.error('[Subscribe] JSON parse error:', parseError)
        // Not JSON - show raw text with status
        throw new Error(`Server returned non-JSON response (${res.status}): ${text.substring(0, 100)}`)
      }
      
      // Check for errors - show server's error message
      if (!res.ok || !data.ok) {
        const errorMsg = data.error || data.message || `Request failed with status ${res.status}`
        console.error('[Subscribe] Server error:', errorMsg)
        throw new Error(errorMsg)
      }
      
      if (data.checkoutUrl) {
        console.log('[Subscribe] Redirecting to Stripe:', data.checkoutUrl.substring(0, 50))
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No checkout URL returned from server')
      }
    } catch (err) {
      console.error('[Subscribe Error]', err)
      setError(err.message)
    } finally {
      setSubscribing(null)
    }
  }
  
  async function handleConnectCalendar(biz) {
    setConnectingCalendar(biz.businessId)
    try {
      // Redirect to Google OAuth with business context
      window.location.href = `/api/integrations/google/auth?jwt=${token}&businessId=${biz.businessId}`
    } catch (err) {
      setError(err.message)
      setConnectingCalendar(null)
    }
  }
  
  function resetForm() {
    setStep('list')
    setBusinessName('')
    setBusinessId('')
    setPlan(null)
    setResult(null)
    setCurrentBusinessId(null)
    setError(null)
    setSelectedBusiness(null)
  }
  
  if (!appReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo className="opacity-90 hover:opacity-100 transition" />
            <div className="hidden md:block h-6 w-px bg-border"></div>
            <span className="hidden md:inline text-sm text-muted-foreground">Business Management</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto max-w-4xl p-6">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {/* Success message for checkout */}
        {searchParams.get('checkout') === 'success' && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <p>Subscription activated successfully!</p>
          </div>
        )}
        
        {/* Success message for Google Calendar connection */}
        {searchParams.get('google_connected') === '1' && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <p>Google Calendar connected successfully!</p>
          </div>
        )}
        
        {/* Error messages */}
        {searchParams.get('error') === 'subscription_required' && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <p>A subscription is required to connect Google Calendar. Please subscribe first.</p>
          </div>
        )}
        
        {searchParams.get('error') === 'business_not_found' && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
            <XCircle className="w-5 h-5" />
            <p>Business not found or you don't have permission to access it.</p>
          </div>
        )}
        
        {/* Business List View */}
        {step === 'list' && (
          <>
            {/* Existing Businesses */}
            {businesses.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Your Businesses
                  </CardTitle>
                  <CardDescription>
                    Manage your registered businesses, subscriptions, and integrations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {businesses.map(biz => (
                      <div key={biz.businessId} className="p-4 rounded-lg border space-y-4">
                        {/* Business Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-lg">{biz.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">{biz.businessId}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[biz.status] || 'bg-gray-100'}`}>
                              {biz.status}
                            </span>
                          </div>
                        </div>
                        
                        {/* Status Cards */}
                        {biz.status === 'ready' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Subscription Status */}
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-2">
                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Subscription</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SUBSCRIPTION_COLORS[biz.subscription?.status] || 'bg-gray-100'}`}>
                                  {biz.subscription?.status || 'none'}
                                </span>
                                {biz.subscription?.status !== 'active' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleSubscribe(biz)}
                                    disabled={subscribing === biz.businessId}
                                  >
                                    {subscribing === biz.businessId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>Subscribe</>
                                    )}
                                  </Button>
                                )}
                                {biz.subscription?.status === 'active' && (
                                  <Check className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                            
                            {/* Calendar Status */}
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Calendar</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${biz.calendar?.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {biz.calendar?.connected ? 'Connected' : 'Not connected'}
                                </span>
                                {!biz.calendar?.connected && biz.subscription?.status === 'active' && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleConnectCalendar(biz)}
                                    disabled={connectingCalendar === biz.businessId}
                                  >
                                    {connectingCalendar === biz.businessId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>Connect</>
                                    )}
                                  </Button>
                                )}
                                {biz.calendar?.connected && (
                                  <Check className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                            
                            {/* Agent Status */}
                            <div className="p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2 mb-2">
                                <Rocket className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Agent</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  biz.subscription?.status === 'active' && biz.calendar?.connected 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {biz.subscription?.status === 'active' && biz.calendar?.connected ? 'Ready' : 'Setup required'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Pending/Failed Actions */}
                        {(biz.status === 'pending' || biz.status === 'failed') && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setCurrentBusinessId(biz.businessId)
                                setBusinessName(biz.name)
                                setStep('form')
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {biz.status === 'failed' ? 'Retry Provisioning' : 'Continue Setup'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Register New Business */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Register New Business
                </CardTitle>
                <CardDescription>
                  Set up a new business to enable AI phone agents, billing, and more.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setStep('form')}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Start Registration
                </Button>
              </CardContent>
            </Card>
          </>
        )}
        
        {/* Registration Form */}
        {step === 'form' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {currentBusinessId ? 'Resume Setup' : 'Register New Business'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePlanSetup} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g., Wallogill Coaching"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="businessId">Business ID</Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="autoGenerate" className="text-sm text-muted-foreground">Auto-generate</Label>
                      <Switch
                        id="autoGenerate"
                        checked={autoGenerateId}
                        onCheckedChange={setAutoGenerateId}
                      />
                    </div>
                  </div>
                  {!autoGenerateId && (
                    <Input
                      id="businessId"
                      value={businessId}
                      onChange={(e) => setBusinessId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                      placeholder="e.g., biz_wallogill"
                      minLength={3}
                      maxLength={50}
                    />
                  )}
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  <p className="text-sm font-medium">Provisioning Options</p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="skipVoice">Skip Voice Test</Label>
                      <p className="text-xs text-muted-foreground">Skip voice connectivity checks</p>
                    </div>
                    <Switch
                      id="skipVoice"
                      checked={skipVoiceTest}
                      onCheckedChange={setSkipVoiceTest}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="skipBilling">Skip Billing Check</Label>
                      <p className="text-xs text-muted-foreground">Skip Stripe verification</p>
                    </div>
                    <Switch
                      id="skipBilling"
                      checked={skipBillingCheck}
                      onCheckedChange={setSkipBillingCheck}
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetForm} type="button">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button type="submit" disabled={loading || !businessName.trim()} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating Plan...
                      </>
                    ) : (
                      <>
                        <ClipboardList className="w-4 h-4 mr-2" />
                        Plan Setup
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        
        {/* Plan Review */}
        {step === 'plan' && plan && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Review Provisioning Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-2">Business ID</p>
                <code className="text-sm bg-background px-2 py-1 rounded">{currentBusinessId}</code>
              </div>
              
              {plan.steps && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Provisioning Steps</p>
                  {plan.steps.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {s.order || idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s.name || s.action}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('form')} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Confirm & Provision
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Confirming */}
        {step === 'confirming' && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
              <p className="text-lg font-medium">Provisioning your business...</p>
              <p className="text-muted-foreground">This may take a few moments.</p>
            </CardContent>
          </Card>
        )}
        
        {/* Result */}
        {step === 'result' && result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                {result.ok ? 'Business Provisioned!' : 'Provisioning Failed'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {result.ok ? (
                <>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-green-800">{result.message}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Next Steps:</p>
                    <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                      <li>Subscribe to a plan to enable all features</li>
                      <li>Connect your Google Calendar</li>
                      <li>Start using your AI phone agent</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-red-800">{result.message || result.error}</p>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button onClick={resetForm} className="flex-1">
                  {result.ok ? 'View Businesses' : 'Try Again'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

// Loading fallback for Suspense
function BusinessPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Main export with Suspense boundary for useSearchParams
export default function BusinessPage() {
  return (
    <Suspense fallback={<BusinessPageLoading />}>
      <BusinessPageContent />
    </Suspense>
  )
}
