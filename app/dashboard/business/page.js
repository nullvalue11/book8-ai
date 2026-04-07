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

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import Header from '@/components/Header'
import HeaderLogo from '@/components/HeaderLogo'
import { BUSINESS_CATEGORIES, CATEGORY_NAMES } from '@/lib/constants/businessCategories'
import GooglePlacesSearch from '@/components/GooglePlacesSearch'
import { placeDetailsToProfileFields } from '@/lib/googlePlaces'
import { getBookingTranslations } from '@/lib/translations'
import { isValidIanaTimeZone } from '@/lib/timezones'
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
  Check,
  Trash2,
  ChevronDown
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

const PLAN_BADGE_COLORS = {
  none: 'bg-gray-100 text-gray-800',
  starter: 'bg-green-100 text-green-800',
  growth: 'bg-blue-100 text-blue-800',
  enterprise: 'bg-purple-100 text-purple-800'
}

function normalizeBusinessPhoneInput(value) {
  if (value == null || typeof value !== 'string') return value
  const cleaned = value.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+') && cleaned.replace(/\D/g, '').length >= 7) {
    return cleaned
  }
  return value
}

function weeklyHoursNonEmpty(wh) {
  if (!wh || typeof wh !== 'object') return false
  return Object.keys(wh).some((k) => Array.isArray(wh[k]) && wh[k].length > 0)
}

/** Subscription status from user (Stripe webhook) or business record */
function getSubscriptionStatus(business, user) {
  if (user?.subscription?.status === 'active' || user?.subscription?.status === 'trialing') {
    // Prefer cleaned business.plan from API, then user.subscription.plan (may be a Stripe price id on stale rows).
    const raw =
      business?.plan || user.subscription?.plan || business?.subscription?.plan || 'starter'
    const plan = typeof raw === 'string' && raw.startsWith('price_') ? business?.plan || 'starter' : raw
    return {
      status: 'active',
      plan,
      label: plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Active'
    }
  }
  if (business?.subscription?.status === 'active' || business?.subscription?.status === 'trialing') {
    const raw = business?.plan || business?.subscription?.plan || 'starter'
    const plan = typeof raw === 'string' && raw.startsWith('price_') ? 'starter' : raw
    return {
      status: 'active',
      plan,
      label: plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Active'
    }
  }
  if (business?.plan && business.plan !== 'none') {
    const plan = business.plan
    return {
      status: 'active',
      plan,
      label: plan.charAt(0).toUpperCase() + plan.slice(1)
    }
  }
  if (business?.stripeSubscriptionId) {
    return { status: 'active', plan: 'starter', label: 'Active' }
  }
  return { status: 'none', plan: null, label: 'None' }
}

/** Calendar status from user (Google OAuth) or business record */
function getCalendarStatus(business, user) {
  // Source of truth for provider label should be the business calendar provider.
  // This prevents showing "Google Calendar" when Outlook is connected.
  const provider =
    business?.calendar?.provider ||
    business?.calendarProvider ||
    (business?.googleCalendarConnected ? 'google' : null) ||
    null

  // Back-compat: if calendar is marked connected but provider is missing, assume Google Calendar.
  const inferredProvider = !provider && business?.calendar?.connected ? 'google' : provider

  if (inferredProvider === 'microsoft') {
    return { connected: true, label: 'Connected (Outlook)', provider: 'microsoft' }
  }
  if (inferredProvider === 'google') {
    return { connected: true, label: 'Connected (Google Calendar)', provider: 'google' }
  }

  return { connected: false, label: 'Not connected', provider: null }
}

/** Agent status from phone-setup (Twilio number assigned) or business fields */
function getAgentStatus(business, phoneSetup) {
  const assigned = phoneSetup?.assignedTwilioNumber ?? business?.assignedTwilioNumber
  const method = phoneSetup?.numberSetupMethod ?? business?.numberSetupMethod
  if (assigned) return { ready: true, label: 'Active' }
  if (method && method !== 'pending') return { ready: true, label: 'Setup in progress' }
  return { ready: false, label: 'Setup required' }
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
  /** Phone setup per businessId from GET /api/business/phone-setup (assignedTwilioNumber, numberSetupMethod) */
  const [phoneSetupByBiz, setPhoneSetupByBiz] = useState({})
  
  // Form state
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('other')
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const categoryDropdownRef = useRef(null)
  const [businessId, setBusinessId] = useState('')
  const [autoGenerateId, setAutoGenerateId] = useState(true)
  const [skipVoiceTest, setSkipVoiceTest] = useState(false)
  const [skipBillingCheck, setSkipBillingCheck] = useState(false)

  /** Optional fields from Google Places or manual entry (POST /api/business/register) */
  const [regStreet, setRegStreet] = useState('')
  const [regStreet2, setRegStreet2] = useState('')
  const [regCity, setRegCity] = useState('')
  const [regProvince, setRegProvince] = useState('')
  const [regPostal, setRegPostal] = useState('')
  const [regCountry, setRegCountry] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regWebsite, setRegWebsite] = useState('')
  const [regTimezone, setRegTimezone] = useState('')
  const [regWeeklyHours, setRegWeeklyHours] = useState(null)
  /** BOO-81B: persist Google place_id with new business for booking-page reviews */
  const [registrationGooglePlaceId, setRegistrationGooglePlaceId] = useState('')
  
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
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  
  // Constants
  const MAX_BUSINESSES = 5

  const gpLabels = useMemo(() => getBookingTranslations('en').googlePlaces, [])

  function clearRegistrationExtras() {
    setRegStreet('')
    setRegStreet2('')
    setRegCity('')
    setRegProvince('')
    setRegPostal('')
    setRegCountry('')
    setRegPhone('')
    setRegWebsite('')
    setRegTimezone('')
    setRegWeeklyHours(null)
    setRegistrationGooglePlaceId('')
  }

  const handleDashboardPlacePicked = useCallback(({ placeId, details }) => {
    if (typeof placeId === 'string' && placeId.trim()) {
      setRegistrationGooglePlaceId(placeId.trim().slice(0, 256))
    } else {
      setRegistrationGooglePlaceId('')
    }
    if (!details) return
    const inner = details?.result || details?.place || details
    const displayName =
      inner && typeof inner === 'object'
        ? inner.displayName || inner.displayNameLong || inner.name
        : null
    const { profile, weeklyHours, category: gpCat, timezoneGuess, placeId: pidFromDetails } =
      placeDetailsToProfileFields(details)
    if (pidFromDetails && !placeId) {
      setRegistrationGooglePlaceId(String(pidFromDetails).trim().slice(0, 256))
    }
    if (typeof displayName === 'string' && displayName.trim()) {
      setBusinessName(displayName.trim().slice(0, 100))
    }
    if (gpCat && CATEGORY_NAMES[gpCat]) {
      setCategory(gpCat)
    }
    setRegStreet(profile.street || '')
    setRegStreet2(profile.street2 || '')
    setRegCity(profile.city || '')
    setRegProvince(profile.provinceState || '')
    setRegPostal(profile.postalCode || '')
    setRegCountry(profile.country || '')
    const phoneRaw = profile.phone || ''
    setRegPhone(phoneRaw ? normalizeBusinessPhoneInput(phoneRaw) || phoneRaw : '')
    setRegWebsite(profile.website || '')
    if (timezoneGuess && isValidIanaTimeZone(timezoneGuess)) {
      setRegTimezone(timezoneGuess)
    } else {
      setRegTimezone('')
    }
    setRegWeeklyHours(weeklyHoursNonEmpty(weeklyHours) ? weeklyHours : null)
  }, [])
  
  // Check for checkout success/cancel and google calendar connection
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout')
    const checkoutBusinessId = searchParams.get('businessId')
    const googleConnected = searchParams.get('google_connected')
    const outlookConnected = searchParams.get('outlook_connected')
    
    if (
      (checkoutStatus === 'success' && checkoutBusinessId) ||
      googleConnected === '1' ||
      outlookConnected === '1'
    ) {
      // Refresh businesses immediately to show updated status
      if (token) {
        fetchBusinesses()
        // Webhook may be processed a few seconds after redirect; refetch so subscription status appears
        const t2 = setTimeout(() => { fetchBusinesses() }, 2500)
        const t5 = setTimeout(() => { fetchBusinesses() }, 5500)
        return () => { clearTimeout(t2); clearTimeout(t5) }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token])
  
  // Load auth on mount (localStorage may have stale user; we refetch below)
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

  // Fetch full user from API (subscription + google so cards show correct status)
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.id) setUser(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  // Fetch phone-setup for each business (for Agent status: assignedTwilioNumber)
  useEffect(() => {
    if (!token || !businesses.length) {
      setPhoneSetupByBiz({})
      return
    }
    let cancelled = false
    const acc = {}
    Promise.all(
      businesses.map(biz =>
        fetch(`/api/business/phone-setup?businessId=${encodeURIComponent(biz.businessId)}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(data => {
          if (!cancelled && data?.ok) acc[biz.businessId] = data
        }).catch(() => {})
      )
    ).then(() => {
      if (!cancelled) setPhoneSetupByBiz(acc)
    })
    return () => { cancelled = true }
  }, [token, businesses])
  
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

  // Close category dropdown on click outside
  useEffect(() => {
    if (!categoryDropdownOpen) return
    function handleClickOutside(e) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [categoryDropdownOpen])
  
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
        category: category || 'other',
        skipVoiceTest,
        skipBillingCheck
      }
      
      if (!autoGenerateId && businessId.trim()) {
        body.businessId = businessId.trim()
      }

      if (regCity.trim()) {
        body.city = regCity.trim().slice(0, 120)
      }
      if (regTimezone.trim() && isValidIanaTimeZone(regTimezone.trim())) {
        body.timezone = regTimezone.trim()
      }

      const bp = {}
      if (regStreet.trim()) bp.street = regStreet.trim().slice(0, 200)
      if (regStreet2.trim()) bp.street2 = regStreet2.trim().slice(0, 200)
      if (regCity.trim()) bp.city = regCity.trim().slice(0, 200)
      if (regProvince.trim()) bp.provinceState = regProvince.trim().slice(0, 200)
      if (regPostal.trim()) bp.postalCode = regPostal.trim().slice(0, 32)
      if (regCountry.trim()) bp.country = regCountry.trim().slice(0, 8).toUpperCase()
      if (regPhone.trim()) bp.phone = regPhone.trim().slice(0, 40)
      if (regWebsite.trim()) bp.website = regWebsite.trim().slice(0, 2048)

      if (Object.keys(bp).length > 0 || weeklyHoursNonEmpty(regWeeklyHours)) {
        body.businessProfile = Object.keys(bp).length > 0 ? bp : {}
      }
      if (weeklyHoursNonEmpty(regWeeklyHours)) {
        body.weeklyHours = regWeeklyHours
      }
      if (registrationGooglePlaceId.trim()) {
        body.googlePlaceId = registrationGooglePlaceId.trim().slice(0, 256)
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
    // Redirect to pricing page where user can choose their plan
    const pricingUrl = `/pricing?paywall=1&businessId=${biz.businessId}`
    console.log('[Subscribe] Redirecting to pricing page:', pricingUrl)
    window.location.href = pricingUrl
  }
  
  async function handleConnectCalendar(biz, provider) {
    setConnectingCalendar(biz.businessId)
    try {
      const authBase =
        provider === 'microsoft'
          ? '/api/integrations/microsoft/auth'
          : '/api/integrations/google/auth'

      window.location.href = `${authBase}?jwt=${token}&businessId=${biz.businessId}`
    } catch (err) {
      setError(err.message)
      setConnectingCalendar(null)
    }
  }

  async function handleDisconnectCalendar(biz, provider) {
    setDisconnectingCalendar(biz.businessId)
    setError(null)
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: biz.businessId })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to disconnect calendar')
      }

      // Refresh so UI shows updated provider connection state.
      fetchBusinesses()
    } catch (err) {
      console.error('[Disconnect] Error:', err.message)
      setError(err.message)
    } finally {
      setDisconnectingCalendar(null)
    }
  }
  
  async function handleDeleteBusiness(biz) {
    // Show confirmation first
    if (deleteConfirm !== biz.businessId) {
      setDeleteConfirm(biz.businessId)
      return
    }
    
    setDeleting(biz.businessId)
    setError(null)
    
    try {
      const res = await fetch('/api/business/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ businessId: biz.businessId })
      })
      
      const data = await res.json()
      
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to delete business')
      }
      
      // Refresh the business list
      fetchBusinesses()
      setDeleteConfirm(null)
      
    } catch (err) {
      console.error('[Delete] Error:', err.message)
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }
  
  function cancelDelete() {
    setDeleteConfirm(null)
  }
  
  // Check if user can delete a business (only if no active subscription)
  function canDeleteBusiness(biz) {
    const sub = getSubscriptionStatus(biz, user)
    return sub.status === 'none' || sub.status === 'canceled'
  }
  
  function resetForm() {
    setStep('list')
    setBusinessName('')
    setCategory('other')
    setCategoryFilter('')
    setCategoryDropdownOpen(false)
    setBusinessId('')
    setPlan(null)
    setResult(null)
    setCurrentBusinessId(null)
    setError(null)
    setSelectedBusiness(null)
    clearRegistrationExtras()
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
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/services')}>
              Services
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/schedule')}>
              Business Hours
            </Button>
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

        {/* Success message for Outlook Calendar connection */}
        {searchParams.get('outlook_connected') === '1' && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <p>Outlook Calendar connected successfully!</p>
          </div>
        )}
        
        {/* Error messages */}
        {searchParams.get('error') === 'subscription_required' && (
          <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <p>A subscription is required to connect Gmail Calendar. Please subscribe first.</p>
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
                            {biz.category && biz.category !== 'other' && (
                              <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_NAMES[biz.category] || biz.category}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[biz.status] || 'bg-gray-100'}`}>
                              {biz.status}
                            </span>
                            {/* Delete button - only show if no active subscription */}
                            {canDeleteBusiness(biz) && (
                              deleteConfirm === biz.businessId ? (
                                <div className="flex items-center gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="destructive"
                                    onClick={() => handleDeleteBusiness(biz)}
                                    disabled={deleting === biz.businessId}
                                  >
                                    {deleting === biz.businessId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      'Confirm'
                                    )}
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={cancelDelete}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteBusiness(biz)}
                                  title="Delete business"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                        
                        {/* Status Cards */}
                        {biz.status === 'ready' && (() => {
                          const subStatus = getSubscriptionStatus(biz, user)
                          const calStatus = getCalendarStatus(biz, user)
                          const agentStatus = getAgentStatus(biz, phoneSetupByBiz[biz.businessId])
                          return (
                            <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Subscription Status */}
                              <div className="p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2 mb-2">
                                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Subscription</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE_COLORS[subStatus.plan || 'none'] || SUBSCRIPTION_COLORS[subStatus.status] || PLAN_BADGE_COLORS.none}`}>
                                    {subStatus.label}
                                  </span>
                                  {subStatus.status !== 'active' && subStatus.status !== 'trialing' && (
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
                                  {(subStatus.status === 'active' || subStatus.status === 'trialing') && (
                                    <Check
                                      className={
                                        subStatus.plan === 'growth'
                                          ? 'w-4 h-4 text-blue-500'
                                          : subStatus.plan === 'enterprise'
                                            ? 'w-4 h-4 text-purple-500'
                                            : 'w-4 h-4 text-green-500'
                                      }
                                    />
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
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${calStatus.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {calStatus.label}
                                  </span>
                                  {!calStatus.connected && (subStatus.status === 'active' || subStatus.status === 'trialing') && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleConnectCalendar(biz, 'google')}
                                        disabled={connectingCalendar === biz.businessId}
                                      >
                                        {connectingCalendar === biz.businessId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>Google</>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleConnectCalendar(biz, 'microsoft')}
                                        disabled={connectingCalendar === biz.businessId}
                                      >
                                        {connectingCalendar === biz.businessId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>Outlook</>
                                        )}
                                      </Button>
                                    </div>
                                  )}
                                  {calStatus.connected && (
                                    <div className="flex items-center gap-2">
                                      <Check className="w-4 h-4 text-green-500" />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDisconnectCalendar(biz, calStatus.provider || 'google')}
                                        disabled={disconnectingCalendar === biz.businessId}
                                      >
                                        {disconnectingCalendar === biz.businessId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>Disconnect</>
                                        )}
                                      </Button>
                                    </div>
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
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${agentStatus.ready ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {agentStatus.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* Public Booking Link */}
                            {(biz.handle || biz.businessId) && (
                              <div className="p-3 rounded-lg bg-muted/50 flex flex-col gap-2 mt-3">
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Public Booking Link</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <code className="text-xs bg-background px-2 py-1 rounded break-all">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/b/{biz.handle || biz.businessId}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${biz.handle || biz.businessId}`
                                      navigator.clipboard.writeText(url).then(() => {}).catch(() => {})
                                    }}
                                  >
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(`/b/${biz.handle || biz.businessId}`, '_blank')}
                                  >
                                    Preview
                                  </Button>
                                </div>
                              </div>
                            )}
                            </>
                          )
                        })()}
                        
                        {/* Pending/Failed Actions */}
                        {(biz.status === 'pending' || biz.status === 'failed') && (
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              onClick={() => {
                                clearRegistrationExtras()
                                setCurrentBusinessId(biz.businessId)
                                setBusinessName(biz.name)
                                setCategory(biz.category || 'other')
                                setCategoryFilter('')
                                setAutoGenerateId(false)
                                setBusinessId(biz.businessId)
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
                  <span className="block mt-1 text-xs">
                    {businesses.length} of {MAX_BUSINESSES} businesses used
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {businesses.length < MAX_BUSINESSES ? (
                  <Button
                    onClick={() => {
                      clearRegistrationExtras()
                      setBusinessName('')
                      setCategory('other')
                      setCategoryFilter('')
                      setBusinessId('')
                      setAutoGenerateId(true)
                      setCurrentBusinessId(null)
                      setPlan(null)
                      setResult(null)
                      setError(null)
                      setStep('form')
                    }}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Start Registration
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 inline mr-2 text-yellow-500" />
                    You have reached the maximum of {MAX_BUSINESSES} businesses. 
                    Delete a business without an active subscription to create a new one.
                  </div>
                )}
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
                {token && gpLabels ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Search your business to auto-fill details, or enter everything manually below.
                    </p>
                    <GooglePlacesSearch
                      authToken={token}
                      labels={gpLabels}
                      idPrefix="dash-reg"
                      onPick={handleDashboardPlacePicked}
                    />
                  </div>
                ) : null}

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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="regStreet">Address</Label>
                    <Input
                      id="regStreet"
                      value={regStreet}
                      onChange={(e) => setRegStreet(e.target.value)}
                      placeholder="Street address"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="regStreet2">Address line 2</Label>
                    <Input
                      id="regStreet2"
                      value={regStreet2}
                      onChange={(e) => setRegStreet2(e.target.value)}
                      placeholder="Suite, unit, etc. (optional)"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regCity">City</Label>
                    <Input
                      id="regCity"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="City"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regProvince">Province / state</Label>
                    <Input
                      id="regProvince"
                      value={regProvince}
                      onChange={(e) => setRegProvince(e.target.value)}
                      placeholder="Region (optional)"
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPostal">Postal code</Label>
                    <Input
                      id="regPostal"
                      value={regPostal}
                      onChange={(e) => setRegPostal(e.target.value)}
                      placeholder="Postal / ZIP"
                      maxLength={32}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regCountry">Country</Label>
                    <Input
                      id="regCountry"
                      value={regCountry}
                      onChange={(e) => setRegCountry(e.target.value)}
                      placeholder="ISO code, e.g. US"
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regPhone">Phone</Label>
                    <Input
                      id="regPhone"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="Business phone (optional)"
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regWebsite">Website</Label>
                    <Input
                      id="regWebsite"
                      value={regWebsite}
                      onChange={(e) => setRegWebsite(e.target.value)}
                      placeholder="https://…"
                      maxLength={2048}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="regTimezone">Timezone</Label>
                    <Input
                      id="regTimezone"
                      value={regTimezone}
                      onChange={(e) => setRegTimezone(e.target.value)}
                      placeholder="IANA timezone, e.g. America/Toronto"
                      maxLength={80}
                    />
                    {regTimezone.trim() && !isValidIanaTimeZone(regTimezone.trim()) ? (
                      <p className="text-xs text-amber-700">
                        Unrecognized timezone; fix before saving or leave blank to use the default.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Business Type *</Label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span>{CATEGORY_NAMES[category] || 'Other'}</span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </button>
                    {categoryDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-lg">
                        <Input
                          placeholder="Search business type..."
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="mb-1 h-8 border-0 bg-transparent focus-visible:ring-0"
                          autoFocus
                        />
                        <ul className="max-h-60 overflow-auto">
                          {BUSINESS_CATEGORIES.filter(c => {
                            const q = (categoryFilter || '').toLowerCase()
                            return !q || (c.name || '').toLowerCase().includes(q)
                          }).map(c => (
                            <li key={c.key}>
                              <button
                                type="button"
                                onClick={() => {
                                  setCategory(c.key)
                                  setCategoryDropdownOpen(false)
                                  setCategoryFilter('')
                                }}
                                className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${category === c.key ? 'bg-accent font-medium' : ''}`}
                              >
                                {c.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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
                  <Button type="submit" disabled={loading || !businessName.trim() || !category} className="flex-1">
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
