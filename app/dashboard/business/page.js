'use client'

/**
 * Business Registration Page
 * 
 * Allows users to register a new business, preview the provisioning plan,
 * and confirm provisioning.
 */

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  RefreshCw
} from 'lucide-react'

// Status badge colors
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  provisioning: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  needs_attention: 'bg-orange-100 text-orange-800',
  failed: 'bg-red-100 text-red-800'
}

export default function BusinessRegisterPage() {
  const router = useRouter()
  
  // Auth state
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [appReady, setAppReady] = useState(false)
  
  // Business state
  const [businesses, setBusinesses] = useState([])
  const [loadingBusinesses, setLoadingBusinesses] = useState(true)
  
  // Form state
  const [businessName, setBusinessName] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [autoGenerateId, setAutoGenerateId] = useState(true)
  const [skipVoiceTest, setSkipVoiceTest] = useState(false)
  const [skipBillingCheck, setSkipBillingCheck] = useState(false)
  
  // Workflow state
  const [step, setStep] = useState('form') // 'form' | 'plan' | 'confirming' | 'result'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [result, setResult] = useState(null)
  const [currentBusinessId, setCurrentBusinessId] = useState(null)
  
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
      
      // Refresh businesses list
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
      
      // Refresh businesses list
      fetchBusinesses()
      
    } catch (err) {
      setError(err.message)
      setStep('plan')
    } finally {
      setLoading(false)
    }
  }
  
  function resetForm() {
    setStep('form')
    setBusinessName('')
    setBusinessId('')
    setPlan(null)
    setResult(null)
    setCurrentBusinessId(null)
    setError(null)
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
            <span className="hidden md:inline text-sm text-muted-foreground">Business Registration</span>
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
        {/* Existing Businesses */}
        {businesses.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Your Businesses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {businesses.map(biz => (
                  <div 
                    key={biz.businessId} 
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{biz.name}</p>
                      <p className="text-sm text-muted-foreground">{biz.businessId}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[biz.status] || 'bg-gray-100'}`}>
                        {biz.status}
                      </span>
                      {biz.status === 'ready' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                      {biz.status === 'failed' && (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Registration Form / Workflow */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === 'form' && <Building2 className="w-5 h-5" />}
              {step === 'plan' && <ClipboardList className="w-5 h-5" />}
              {step === 'confirming' && <Loader2 className="w-5 h-5 animate-spin" />}
              {step === 'result' && (result?.ok ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />)}
              
              {step === 'form' && 'Register New Business'}
              {step === 'plan' && 'Review Provisioning Plan'}
              {step === 'confirming' && 'Provisioning...'}
              {step === 'result' && (result?.ok ? 'Business Provisioned!' : 'Provisioning Failed')}
            </CardTitle>
            <CardDescription>
              {step === 'form' && 'Set up your business to enable AI phone agents, billing, and more.'}
              {step === 'plan' && 'Review the steps that will be executed to provision your business.'}
              {step === 'confirming' && 'Please wait while we set up your business...'}
              {step === 'result' && (result?.ok ? 'Your business is ready to use.' : 'Something went wrong. Please try again.')}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Error Display */}
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            {/* Step: Form */}
            {step === 'form' && (
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
                  <p className="text-xs text-muted-foreground">
                    {autoGenerateId 
                      ? 'A unique ID will be generated automatically.' 
                      : 'Letters, numbers, underscores, and hyphens only.'}
                  </p>
                </div>
                
                <div className="space-y-4 pt-4 border-t">
                  <p className="text-sm font-medium">Provisioning Options</p>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="skipVoice">Skip Voice Test</Label>
                      <p className="text-xs text-muted-foreground">Skip voice connectivity checks during setup</p>
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
                      <p className="text-xs text-muted-foreground">Skip Stripe configuration verification</p>
                    </div>
                    <Switch
                      id="skipBilling"
                      checked={skipBillingCheck}
                      onCheckedChange={setSkipBillingCheck}
                    />
                  </div>
                </div>
                
                <Button type="submit" disabled={loading || !businessName.trim()} className="w-full">
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
              </form>
            )}
            
            {/* Step: Plan Review */}
            {step === 'plan' && plan && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Business ID</p>
                  <code className="text-sm bg-background px-2 py-1 rounded">{currentBusinessId}</code>
                </div>
                
                {/* Plan Steps */}
                {plan.steps && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Provisioning Steps</p>
                    {plan.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                          {step.order || idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{step.name || step.action}</p>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Warnings */}
                {plan.warnings?.length > 0 && (
                  <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                    <p className="font-medium text-yellow-800 mb-2">Warnings</p>
                    <ul className="text-sm text-yellow-700 list-disc list-inside">
                      {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetForm} disabled={loading}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Confirm & Provision
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Step: Confirming */}
            {step === 'confirming' && (
              <div className="text-center py-8">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
                <p className="text-lg font-medium">Provisioning your business...</p>
                <p className="text-muted-foreground">This may take a few moments.</p>
              </div>
            )}
            
            {/* Step: Result */}
            {step === 'result' && result && (
              <div className="space-y-6">
                {result.ok ? (
                  <>
                    <div className="text-center py-4">
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium text-green-700">{result.message}</p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Business ID</p>
                          <p className="font-mono">{result.businessId}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium text-green-700">{result.status}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Features */}
                    {result.features && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Features Enabled</p>
                        <div className="flex gap-2 flex-wrap">
                          {result.features.voiceEnabled && (
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">Voice</span>
                          )}
                          {result.features.billingEnabled && (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">Billing</span>
                          )}
                          {result.features.agentEnabled && (
                            <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 text-xs">Agent</span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-center py-4">
                      <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                      <p className="text-lg font-medium text-red-700">{result.message || 'Provisioning failed'}</p>
                    </div>
                    
                    {result.error && (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-800">{result.error}</p>
                      </div>
                    )}
                  </>
                )}
                
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button onClick={resetForm} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Register Another
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
