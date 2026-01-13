'use client'

/**
 * Calendar Integrations Hub
 * 
 * SaaS-style page for connecting calendar providers.
 * Currently supports: Google Calendar, Microsoft Outlook
 * Coming soon: Zoho, iCloud, CalDAV
 */

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import HeaderLogo from '@/components/HeaderLogo'
import { 
  ArrowLeft, 
  Calendar, 
  Check, 
  ExternalLink, 
  Loader2,
  Lock,
  Crown,
  AlertCircle
} from 'lucide-react'

// Calendar provider configurations
const PROVIDERS = [
  {
    id: 'google',
    name: 'Google Calendar',
    description: 'Connect your Google Calendar to sync events and availability',
    logo: '/google-calendar.svg',
    color: 'bg-white border-gray-200',
    available: true,
    enterpriseOnly: false
  },
  {
    id: 'microsoft',
    name: 'Microsoft Outlook',
    description: 'Connect your Outlook or Office 365 calendar',
    logo: '/outlook-calendar.svg',
    color: 'bg-white border-blue-200',
    available: true,
    enterpriseOnly: false
  },
  {
    id: 'zoho',
    name: 'Zoho Calendar',
    description: 'Connect your Zoho Calendar for seamless integration',
    logo: '/zoho-calendar.svg',
    color: 'bg-white border-green-200',
    available: false,
    enterpriseOnly: true,
    comingSoon: true
  },
  {
    id: 'icloud',
    name: 'Apple iCloud',
    description: 'Connect your iCloud Calendar',
    logo: '/icloud-calendar.svg',
    color: 'bg-white border-gray-200',
    available: false,
    enterpriseOnly: true,
    comingSoon: true
  }
]

function CalendarIntegrationsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [appReady, setAppReady] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const [error, setError] = useState(null)
  
  // Subscription state
  const [planTier, setPlanTier] = useState('free')
  const [features, setFeatures] = useState({})
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  // Connected providers
  const [connectedProviders, setConnectedProviders] = useState({})
  const [loadingStatus, setLoadingStatus] = useState(true)
  
  // Load auth
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
  
  // Check for connection success/error from OAuth callback
  useEffect(() => {
    const success = searchParams.get('connected')
    const errorParam = searchParams.get('error')
    const provider = searchParams.get('provider')
    
    if (success === '1' && provider) {
      // Refresh connection status
      fetchConnectionStatus()
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('provider')
      window.history.replaceState({}, '', url.toString())
    }
    
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  
  // Fetch subscription and connection status
  useEffect(() => {
    if (token) {
      fetchSubscriptionStatus()
      fetchConnectionStatus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])
  
  async function fetchSubscriptionStatus() {
    try {
      const res = await fetch('/api/billing/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.ok) {
        setIsSubscribed(data.subscribed)
        setPlanTier(data.planTier || 'free')
        setFeatures(data.features || {})
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err)
    }
  }
  
  async function fetchConnectionStatus() {
    setLoadingStatus(true)
    try {
      // Fetch Google status
      const googleRes = await fetch('/api/integrations/google/status', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const googleData = await googleRes.json()
      
      setConnectedProviders(prev => ({
        ...prev,
        google: googleData.connected || false
      }))
      
      // TODO: Add Microsoft status check when implemented
      // const msRes = await fetch('/api/integrations/microsoft/status', ...)
      
    } catch (err) {
      console.error('Failed to fetch connection status:', err)
    } finally {
      setLoadingStatus(false)
    }
  }
  
  async function handleConnect(providerId) {
    setConnecting(providerId)
    setError(null)
    
    try {
      if (providerId === 'google') {
        // Redirect to Google OAuth
        window.location.href = `/api/integrations/google/auth?jwt=${token}`
      } else if (providerId === 'microsoft') {
        // Redirect to Microsoft OAuth
        window.location.href = `/api/integrations/microsoft/auth?jwt=${token}`
      } else {
        setError(`${providerId} integration is coming soon!`)
        setConnecting(null)
      }
    } catch (err) {
      setError(err.message)
      setConnecting(null)
    }
  }
  
  async function handleDisconnect(providerId) {
    setConnecting(providerId)
    setError(null)
    
    try {
      const res = await fetch(`/api/integrations/${providerId}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (!data.ok) {
        throw new Error(data.error || 'Failed to disconnect')
      }
      
      setConnectedProviders(prev => ({
        ...prev,
        [providerId]: false
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(null)
    }
  }
  
  // Check if user can connect a provider
  function canConnect(provider) {
    if (!isSubscribed) return false
    if (!features.calendar) return false
    if (provider.enterpriseOnly && planTier !== 'enterprise') return false
    return provider.available
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
            <span className="hidden md:inline text-sm text-muted-foreground">Calendar Integrations</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>
      
      <div className="container mx-auto max-w-4xl p-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-brand-500" />
            Connect Your Calendar
          </h1>
          <p className="text-muted-foreground mt-2">
            Sync your calendar to automatically manage availability and prevent double bookings.
          </p>
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}
        
        {/* Subscription Warning */}
        {!isSubscribed && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 flex items-start gap-3">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Subscription Required</p>
              <p className="text-sm">Calendar integrations require an active subscription.</p>
            </div>
            <Button 
              size="sm" 
              className="ml-auto"
              onClick={() => router.push('/pricing?paywall=1&feature=calendar')}
            >
              View Plans
            </Button>
          </div>
        )}
        
        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map(provider => {
            const isConnected = connectedProviders[provider.id]
            const canConnectProvider = canConnect(provider)
            const isEnterpriseLocked = provider.enterpriseOnly && planTier !== 'enterprise'
            
            return (
              <Card 
                key={provider.id} 
                className={`${provider.color} ${provider.comingSoon ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Provider Icon */}
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        {provider.id === 'google' && (
                          <svg className="w-7 h-7" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {provider.id === 'microsoft' && (
                          <svg className="w-7 h-7" viewBox="0 0 24 24">
                            <path fill="#F25022" d="M1 1h10v10H1z"/>
                            <path fill="#00A4EF" d="M13 1h10v10H13z"/>
                            <path fill="#7FBA00" d="M1 13h10v10H1z"/>
                            <path fill="#FFB900" d="M13 13h10v10H13z"/>
                          </svg>
                        )}
                        {provider.id === 'zoho' && <Calendar className="w-7 h-7 text-green-600" />}
                        {provider.id === 'icloud' && <Calendar className="w-7 h-7 text-gray-600" />}
                      </div>
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {provider.name}
                          {isConnected && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Connected
                            </span>
                          )}
                          {provider.comingSoon && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Coming Soon
                            </span>
                          )}
                          {isEnterpriseLocked && !provider.comingSoon && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                              <Crown className="w-3 h-3" />
                              Enterprise
                            </span>
                          )}
                        </CardTitle>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-2">{provider.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(provider.id)}
                        disabled={connecting === provider.id}
                      >
                        {connecting === provider.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Disconnect
                      </Button>
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Syncing
                      </span>
                    </div>
                  ) : provider.comingSoon ? (
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  ) : !isSubscribed ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push('/pricing?paywall=1&feature=calendar')}
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Subscribe to Connect
                    </Button>
                  ) : isEnterpriseLocked ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push('/pricing?paywall=1')}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Upgrade to Enterprise
                    </Button>
                  ) : (
                    <Button 
                      size="sm"
                      onClick={() => handleConnect(provider.id)}
                      disabled={connecting === provider.id || !canConnectProvider}
                    >
                      {connecting === provider.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        {/* Enterprise Features */}
        {planTier === 'enterprise' && (
          <Card className="mt-8 border-purple-200 bg-purple-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Crown className="w-5 h-5" />
                Enterprise Calendar Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-purple-700">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Connect multiple calendars from different providers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Advanced availability rules and buffer times
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Priority sync (updates within 1 minute)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Team calendar aggregation
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}

// Loading fallback
function CalendarLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )
}

// Export with Suspense for useSearchParams
export default function CalendarIntegrationsPage() {
  return (
    <Suspense fallback={<CalendarLoading />}>
      <CalendarIntegrationsContent />
    </Suspense>
  )
}
