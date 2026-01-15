"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import Header from "./components/Header";
import HeaderLogo from "./components/HeaderLogo";
import HomeHero from "./(home)/HomeHero";
import { useTheme } from "next-themes";
import { QrCode, Share2, Settings, ExternalLink, Check, Moon, Sun, Lock, CreditCard, Building2, Sparkles, Crown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }

// Confetti helper - dynamically import to avoid SSR issues
async function fireConfetti() {
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    // Fire a second burst
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 200);
  } catch (e) {
    console.log('Confetti not available');
  }
}

import { Suspense } from "react";

// Loading fallback for Suspense
function HomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
    </div>
  );
}

// Main home content component
function HomeContent(props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceDashboard = !!props?.forceDashboard;
  const { theme, setTheme, systemTheme } = useTheme();
  const resolved = theme === "system" ? systemTheme : theme;

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [appReady, setAppReady] = useState(false);
  
  // Subscription state - enhanced
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [planTier, setPlanTier] = useState('free');
  const [planName, setPlanName] = useState('Free');
  const [features, setFeatures] = useState({});
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);
  const [isSyncingSubscription, setIsSyncingSubscription] = useState(false);

  const [title, setTitle] = useState("Intro call");
  const [customerName, setCustomerName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const detectedTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } }, []);
  const [timeZone, setTimeZone] = useState(detectedTz);

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [googleStatus, setGoogleStatus] = useState({ connected: false, lastSyncedAt: null });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [savingCalendars, setSavingCalendars] = useState(false);

  const [archivedCount, setArchivedCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" or "register"

  const fetchAbort = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem("book8_token");
        const u = localStorage.getItem("book8_user");
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      }
    } finally {
      setAppReady(true);
    }
  }, []);

  // Redirect away from marketing when logged in
  useEffect(() => {
    if (appReady && token && typeof window !== 'undefined' && window.location.pathname === '/') {
      try { window.location.replace('/dashboard'); } catch {}
    }
  }, [appReady, token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) { refreshUser(); fetchBookings(); fetchGoogleStatus(); fetchArchivedCount(); checkSubscription(); } }, [token]);

  // Check for checkout success (from pricing page redirect)
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    
    if (checkoutStatus === 'success' || sessionId) {
      console.log('[Dashboard] Checkout success detected, syncing subscription...');
      
      if (token) {
        // First, call the sync endpoint to ensure database is up to date
        // Then check subscription status
        const syncAndCheck = async () => {
          try {
            // Step 1: Call sync endpoint to fetch from Stripe
            console.log('[Dashboard] Calling /api/billing/sync...');
            const syncRes = await fetch('/api/billing/sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store'
            });
            const syncData = await syncRes.json();
            console.log('[Dashboard] Sync response:', syncData);
            
            if (syncData.ok && syncData.subscribed) {
              // Sync found active subscription!
              setIsSubscribed(true);
              setPlanTier(syncData.planTier || 'starter');
              setPlanName(syncData.planName || 'Starter');
              setFeatures(syncData.features || {});
              setSubscriptionChecked(true);
              setShowSubscriptionSuccess(true);
              fireConfetti();
              setTimeout(() => setShowSubscriptionSuccess(false), 5000);
              console.log('[Dashboard] Subscription synced and confirmed!');
              return;
            }
            
            // Step 2: If sync didn't find it, retry a few times
            // Stripe might take a moment to process
            let attempts = 0;
            const maxAttempts = 5;
            
            const checkWithRetry = async () => {
              attempts++;
              console.log(`[Dashboard] Subscription check attempt ${attempts}/${maxAttempts}`);
              
              // Try sync again
              const retryRes = await fetch('/api/billing/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
              });
              const retryData = await retryRes.json();
              
              if (retryData.ok && retryData.subscribed) {
                setIsSubscribed(true);
                setPlanTier(retryData.planTier || 'starter');
                setPlanName(retryData.planName || 'Starter');
                setFeatures(retryData.features || {});
                setSubscriptionChecked(true);
                setShowSubscriptionSuccess(true);
                fireConfetti();
                setTimeout(() => setShowSubscriptionSuccess(false), 5000);
                console.log('[Dashboard] Subscription confirmed on retry!');
              } else if (attempts < maxAttempts) {
                console.log('[Dashboard] Not subscribed yet, retrying in 2s...');
                setTimeout(checkWithRetry, 2000);
              } else {
                console.log('[Dashboard] Max attempts reached');
                setSubscriptionChecked(true);
              }
            };
            
            setTimeout(checkWithRetry, 2000);
            
          } catch (err) {
            console.error('[Dashboard] Sync error:', err);
            setSubscriptionChecked(true);
          }
        };
        
        syncAndCheck();
      }
      
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  // Manual subscription sync function
  async function syncSubscription() {
    setIsSyncingSubscription(true);
    try {
      console.log('[Dashboard] Manual sync triggered');
      const res = await fetch('/api/billing/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('[Dashboard] Sync response:', data);
      
      if (data.ok && data.subscribed) {
        setIsSubscribed(true);
        setPlanTier(data.planTier || 'starter');
        setPlanName(data.planName || 'Starter');
        setFeatures(data.features || {});
        setShowSubscriptionSuccess(true);
        fireConfetti();
        setTimeout(() => setShowSubscriptionSuccess(false), 5000);
      } else if (data.ok) {
        alert(data.message || 'No active subscription found');
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch (err) {
      console.error('[Dashboard] Sync error:', err);
      alert('Failed to sync subscription: ' + err.message);
    } finally {
      setIsSyncingSubscription(false);
    }
  }

  // Check subscription status
  async function checkSubscription(showSuccessOnActive = false) {
    try {
      const res = await fetch('/api/billing/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.ok) {
        setIsSubscribed(data.subscribed);
        setPlanTier(data.planTier || 'free');
        setPlanName(data.planName || 'Free');
        setFeatures(data.features || {});
        
        // Show success message and confetti if just subscribed
        if (showSuccessOnActive && data.subscribed) {
          setShowSubscriptionSuccess(true);
          fireConfetti();
          // Auto-hide after 5 seconds
          setTimeout(() => setShowSubscriptionSuccess(false), 5000);
        }
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
    } finally {
      setSubscriptionChecked(true);
    }
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
    const res = await fetch(`/api${path}`, { ...opts, headers });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error(body?.error || body || `Request failed: ${res.status}`);
    return body;
  }

  async function refreshUser() {
    const controller = new AbortController();
    fetchAbort.current = controller;
    try {
      const req = fetch('/api/user', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const res = await req;
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load user');
      setUser(data);
    } catch {}
  }

  async function fetchBookings() { try { setLoadingBookings(true); const list = await api(`/bookings`, { method: "GET" }); setBookings(list || []); } catch {} finally { setLoadingBookings(false); } }
  async function cancelBooking(id) { if (!confirm("Cancel this booking?")) return; try { await api(`/bookings/${id}`, { method: "DELETE" }); await fetchBookings(); } catch (err) { alert(err.message); } }
  async function archiveBookings() { if (!confirm("Archive all completed and canceled bookings?")) return; try { const result = await api(`/bookings/archive`, { method: "POST" }); alert(`Archived ${result.archived || 0} booking(s)`); await fetchBookings(); await fetchArchivedCount(); } catch (err) { alert(err.message); } }
  async function fetchArchivedCount() { try { const items = await api(`/bookings/archived`, { method: "GET" }); setArchivedCount((items || []).length); } catch {} }

  async function createBooking(e) { e.preventDefault(); try { const payload = { title, customerName, startTime: startTime ? new Date(startTime).toISOString() : null, endTime: endTime ? new Date(endTime).toISOString() : null, notes, timeZone, }; const created = await api(`/bookings`, { method: "POST", headers: { "x-client-timezone": timeZone }, body: JSON.stringify(payload), }); setTitle("Intro call"); setCustomerName(""); setStartTime(""); setEndTime(""); setNotes(""); await fetchBookings(); alert(`Booking created: ${created?.title || created?.id}`); } catch (err) { alert(err.message); } }

  async function fetchGoogleStatus() { try { const status = await api(`/integrations/google/sync`, { method: "GET" }); setGoogleStatus(status || { connected: false, lastSyncedAt: null }); } catch { setGoogleStatus({ connected: false, lastSyncedAt: null }); } }
  async function connectGoogle() { 
    if (!token) return alert("Please login first"); 
    if (!isSubscribed) {
      router.push('/pricing?paywall=1&feature=calendar');
      return;
    }
    window.location.href = `/api/integrations/google/auth?jwt=${token}`; 
  }
  async function openCalendars() { try { const res = await api(`/integrations/google/calendars`, { method: "GET" }); setCalendars(res?.calendars || []); setCalendarDialogOpen(true); } catch (err) { alert(err.message || "Failed to load calendars"); } }
  async function saveCalendars() { try { setSavingCalendars(true); const selected = calendars.filter((c) => c.selected).map((c) => c.id); await api(`/integrations/google/calendars`, { method: "POST", body: JSON.stringify({ selectedCalendarIds: selected }), }); setCalendarDialogOpen(false); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Failed to save selections"); } finally { setSavingCalendars(false); } }
  async function syncGoogle() { try { const res = await api(`/integrations/google/sync`, { method: "POST" }); alert(`Synced: created=${res.created}, updated=${res.updated}, deleted=${res.deleted}`); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Sync failed"); } }

  function handleLogout() { 
    // Abort any pending fetches
    if (fetchAbort.current) try { fetchAbort.current.abort(); } catch {} 
    // Clear local storage
    localStorage.removeItem("book8_token"); 
    localStorage.removeItem("book8_user"); 
    // Clear all state
    setToken(null); 
    setUser(null); 
    setBookings([]); 
    setIsSubscribed(false);
    setPlanTier('free');
    setPlanName('Free');
    setFeatures({});
    setSubscriptionChecked(false);
    // Immediately redirect to home
    router.push('/');
  }

  async function handleLogin() {
    if (!formData.email || !formData.password) {
      setFormError("Please enter both email and password");
      return;
    }
    try {
      setFormError("");
      setIsLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('book8_token', data.token);
      localStorage.setItem('book8_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setFormData({ email: "", password: "", name: "" });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    if (!formData.email || !formData.password) {
      setFormError("Please enter both email and password");
      return;
    }
    if (formData.password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    try {
      setFormError("");
      setIsLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email, 
          password: formData.password,
          name: formData.name || ""
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('book8_token', data.token);
      localStorage.setItem('book8_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setFormData({ email: "", password: "", name: "" });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function copyBookingLink() {
    if (!user?.scheduling?.handle) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/b/${user.scheduling.handle}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(err => alert('Failed to copy: ' + err.message));
  }

  function shareBookingLink(platform) {
    if (!user?.scheduling?.handle) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/b/${user.scheduling.handle}`;
    const text = 'Book time with me';
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
    };
    if (urls[platform]) window.open(urls[platform], '_blank', 'width=600,height=400');
  }

  if (!appReady) {
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
            </div>
          </div>
        </header>
        <div className="container mx-auto max-w-7xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 rounded-lg bg-muted" />
            <div className="h-64 rounded-lg bg-muted lg:col-span-2" />
          </div>
        </div>
      </main>
    );
  }

  if (!token && !forceDashboard) {
    return (
      <main className="min-h-screen bg-[#0A0F14] text-white">
        <Header />
        <HomeHero />

        <section id="auth" className="container mx-auto max-w-md px-6 py-16">
          <Card className="bg-card/50 backdrop-blur border-white/10">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <p className="text-sm text-muted-foreground text-center">
                {authMode === "login" 
                  ? "Sign in to manage your bookings" 
                  : "Get started with Book8 AI today"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OAuth Social Login Buttons */}
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  onClick={() => {
                    const callbackUrl = encodeURIComponent('/auth/oauth-callback');
                    window.location.href = `/api/auth/signin/google?callbackUrl=${callbackUrl}`;
                  }}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  onClick={() => {
                    const callbackUrl = encodeURIComponent('/auth/oauth-callback');
                    window.location.href = `/api/auth/signin/azure-ad?callbackUrl=${callbackUrl}`;
                  }}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Continue with Microsoft
                </Button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-card text-muted-foreground">or continue with email</span>
                </div>
              </div>

              {/* Auth Mode Tabs */}
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                <button
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMode === "login" 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setAuthMode("login"); setFormError(""); }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMode === "register" 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setAuthMode("register"); setFormError(""); }}
                >
                  Register
                </button>
              </div>

              {/* Name field (only for register) */}
              {authMode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setFormError("");
                    }}
                    className="bg-background/50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setFormError("");
                  }}
                  className="bg-background/50"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setFormError("");
                  }}
                  className="bg-background/50"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                />
                {authMode === "register" && (
                  <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}

              <Button 
                className="w-full bg-brand-500 hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500" 
                onClick={authMode === "login" ? handleLogin : handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {authMode === "login" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  authMode === "login" ? "Sign In" : "Create Account"
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {authMode === "login" ? (
                  <p>
                    Don&apos;t have an account?{" "}
                    <button 
                      className="text-brand-500 hover:text-brand-400 font-medium"
                      onClick={() => { setAuthMode("register"); setFormError(""); }}
                    >
                      Register
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{" "}
                    <button 
                      className="text-brand-500 hover:text-brand-400 font-medium"
                      onClick={() => { setAuthMode("login"); setFormError(""); }}
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo className="opacity-90 hover:opacity-100 transition" />
            <div className="hidden md:block h-6 w-px bg-border"></div>
            <span className="hidden md:inline text-sm text-muted-foreground">Dashboard</span>
            {/* Plan badge for subscribed users */}
            {subscriptionChecked && isSubscribed && (
              <span className={`hidden md:inline px-2 py-0.5 rounded-full text-xs font-medium ${
                planTier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                planTier === 'growth' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {planTier === 'enterprise' && <Crown className="w-3 h-3 inline mr-1" />}
                {planName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle resolved={resolved} setTheme={setTheme} />
            <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">{user?.email}</span>
            <Button variant="destructive" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      {/* Subscription Success Modal */}
      {showSubscriptionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-xl p-8 shadow-2xl max-w-md mx-4 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're Subscribed! 🎉</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to <span className="font-semibold text-foreground">{planName}</span>! 
              {planTier === 'enterprise' && ' You now have access to all premium features including advanced analytics, multi-calendar support, and priority support.'}
              {planTier === 'growth' && ' You now have access to multi-calendar support and all standard features.'}
              {planTier === 'starter' && ' You now have access to calendar sync, AI agents, and analytics.'}
            </p>
            <Button 
              className="bg-brand-500 hover:bg-brand-600"
              onClick={() => setShowSubscriptionSuccess(false)}
            >
              Start Exploring
            </Button>
          </div>
        </div>
      )}

      {/* Top Subscription Banner - only show if NOT subscribed */}
      {subscriptionChecked && !isSubscribed && (
        <div className="bg-brand-500 border-b border-brand-600">
          <div className="container mx-auto max-w-7xl px-6 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-white">
                <Lock className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">
                  <span className="hidden sm:inline">Unlock all features — </span>
                  Subscribe to connect calendars, use AI agents, and access analytics.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-white border-white/50 hover:bg-white/10 text-xs"
                  onClick={syncSubscription}
                  disabled={isSyncingSubscription}
                >
                  {isSyncingSubscription ? 'Syncing...' : 'Already paid? Sync'}
                </Button>
                <Button 
                  size="sm" 
                  className="bg-white text-brand-600 hover:bg-gray-100 font-semibold shrink-0 shadow-sm"
                  onClick={() => router.push('/pricing?paywall=1')}
                >
                  Subscribe Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-7xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card">
            <CardHeader><CardTitle>Create Booking</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={createBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="customer">Customer</Label><Input id="customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="start">Start</Label><Input id="start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="end">End</Label><Input id="end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                <div className="md:col-span-2 flex gap-3"><Button type="submit">Create</Button><Button type="button" variant="secondary" onClick={fetchBookings}>Refresh</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Subscription Banner - show if not subscribed */}
              {subscriptionChecked && !isSubscribed && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/20 mb-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-brand-500">Subscription Required</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Subscribe to unlock calendar sync, phone agent features, and more.
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-3 bg-brand-500 hover:bg-brand-600"
                        onClick={() => router.push('/pricing?paywall=1')}
                      >
                        View Plans
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      Google Calendar
                      {!isSubscribed && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {!isSubscribed 
                        ? "Subscribe to activate calendar sync" 
                        : googleStatus?.connected 
                          ? `Connected • Last synced ${googleStatus?.lastSyncedAt ? formatDT(googleStatus.lastSyncedAt) : "never"}` 
                          : "Not connected"
                      }
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant={googleStatus?.connected ? "secondary" : "default"} 
                    onClick={connectGoogle} 
                    className="shrink-0"
                    disabled={!isSubscribed}
                  >
                    {!isSubscribed ? "Locked" : googleStatus?.connected ? "Reconnect" : "Connect"}
                  </Button>
                </div>
                {googleStatus?.connected && isSubscribed && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button size="sm" variant="secondary" onClick={openCalendars}>Choose calendars</Button>
                    <Button size="sm" onClick={syncGoogle}>Sync now</Button>
                  </div>
                )}
                {calendarDialogOpen && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-sm font-medium mb-2">Select calendars</p>
                    <div className="space-y-2 max-h-60 overflow-auto pr-2">
                      {calendars?.length ? calendars.map((cal) => (
                        <label key={cal.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!cal.selected} onChange={(e) => setCalendars((prev) => prev.map((c) => c.id === cal.id ? { ...c, selected: e.target.checked } : c))} />
                          <span>{cal.summary} {cal.primary ? "(primary)" : ""}</span>
                        </label>
                      )) : <p className="text-xs text-muted-foreground">No calendars loaded</p>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={saveCalendars} disabled={savingCalendars}>{savingCalendars ? "Saving..." : "Save"}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setCalendarDialogOpen(false)}>Close</Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium">Public Booking Link</p>
                  {user?.scheduling?.handle && (
                    <Button size="sm" variant="ghost" onClick={() => window.location.href = '/dashboard/settings/scheduling'}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {user?.scheduling?.handle ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md break-all text-sm">
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="flex-1 min-w-0 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/b/{user.scheduling.handle}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={copyBookingLink} className="gap-2">{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy Link'}</Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(`/b/${user.scheduling.handle}`, '_blank')}>Preview</Button>
                    </div>
                    <div className="flex justify-center p-4 bg-white rounded-md">
                      <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${user?.scheduling?.handle || ''}`} size={160} level="H" includeMargin={true} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Set up your public booking page to accept bookings from anyone.</p>
                    <Button size="sm" onClick={() => window.location.href = '/dashboard/settings/scheduling'}>Configure Scheduling</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Business Registration Card */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Register and provision your business to enable AI phone agents, billing integration, and more.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => router.push('/dashboard/business')}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Manage Business
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Your Bookings</CardTitle>
                <div className="flex items-center gap-2">
                  {archivedCount > 0 && (<span className="text-xs text-muted-foreground">{archivedCount} archived</span>)}
                  <Button size="sm" variant="outline" onClick={archiveBookings}>Clear</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBookings ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {(bookings || []).length === 0 && <p className="text-muted-foreground">No bookings yet.</p>}
                  {(bookings || []).map((b) => (
                    <div key={b.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded border p-2">
                      <div className="md:col-span-2 font-medium">{b.title}</div>
                      <div>{b.customerName}</div>
                      <div>{formatDT(b.startTime)}</div>
                      <div>{formatDT(b.endTime)}</div>
                      <div className="text-right"><Button size="sm" variant="destructive" onClick={() => cancelBooking(b.id)} disabled={b.status === 'canceled'}>Cancel</Button></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <AnalyticsDashboard token={token} subscribed={isSubscribed} />
        </div>
      </div>
    </main>
  );
}

function ThemeToggle({ resolved, setTheme }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const isLight = mounted && resolved === 'light';
  const isDark = mounted && resolved === 'dark';
  const isSystem = mounted && resolved !== 'dark' && resolved !== 'light';

  return (
    <div className="flex items-center gap-2">
      <button aria-label="Light" className={`p-2 rounded-md border ${isLight ? 'bg-secondary' : ''}`} onClick={() => setTheme('light')}>
        <Sun className="h-4 w-4" />
      </button>
      <button aria-label="Dark" className={`p-2 rounded-md border ${isDark ? 'bg-secondary' : ''}`} onClick={() => setTheme('dark')}>
        <Moon className="h-4 w-4" />
      </button>
      <button aria-label="System" className={`p-2 rounded-md border ${isSystem ? 'bg-secondary' : ''}`} onClick={() => setTheme('system')}>
        Sys
      </button>
    </div>
  );
}


// Export with Suspense wrapper for useSearchParams
export default function Home(props) {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent {...props} />
    </Suspense>
  );
}
