"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun, Copy, Check, QrCode, Share2, Settings, ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";
import { QRCodeSVG } from "qrcode.react";
import AnalyticsDashboard from "./components/AnalyticsDashboard";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }
function toAmount(obj) { const o = obj?.rawEvent?.data?.object || {}; const currency = (o.currency || o.lines?.data?.[0]?.price?.currency || "usd").toUpperCase(); const cent = o.amount_paid ?? o.amount_due ?? o.amount ?? o.total ?? null; if (cent == null) return null; return `${(cent / 100).toFixed(2)} ${currency}`; }
function StatusBadge({ status }) { const s = String(status || "").toLowerCase(); if (["paid","succeeded","active","completed"].some(x => s.includes(x))) return <Badge className="bg-green-600">success</Badge>; if (["failed","past_due","canceled","unpaid"].some(x => s.includes(x))) return <Badge className="bg-red-600">failed</Badge>; return <Badge className="bg-yellow-500 text-black">pending</Badge>; }

export default function Home(props) {
  const forceDashboard = !!props?.forceDashboard;
  const { theme, setTheme, systemTheme } = useTheme();
  const resolved = theme === "system" ? systemTheme : theme;

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [title, setTitle] = useState("Intro call");
  const [customerName, setCustomerName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const detectedTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } }, []);
  const [timeZone, setTimeZone] = useState(detectedTz);

  const [googleStatus, setGoogleStatus] = useState({ connected: false, lastSyncedAt: null });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [savingCalendars, setSavingCalendars] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantContext, setAssistantContext] = useState("");
  const [assistantResults, setAssistantResults] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  // Auth helper
  const isAuthed = !!user;

  const [bLogs, setBLogs] = useState([]);
  const [bPage, setBPage] = useState(1);
  const [bHasMore, setBHasMore] = useState(true);
  const [bLoading, setBLoading] = useState(false);

  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState("");
  const fetchAbort = useRef(null);

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [appReady, setAppReady] = useState(false);
  const [pathname, setPathname] = useState('');


  useEffect(() => { 
    try {
      if (typeof window !== 'undefined') {
        setPathname(window.location.pathname);
        const t = localStorage.getItem("book8_token"); 
        const u = localStorage.getItem("book8_user"); 
        if (t) setToken(t); 
        if (u) setUser(JSON.parse(u)); 
      }
    } finally {
      setAppReady(true);
    }
  }, []);

  // If already authenticated and currently on '/', redirect to dedicated dashboard route to avoid SSR/CSR layout conflicts
  useEffect(() => {
    if (appReady && token && typeof window !== 'undefined' && window.location.pathname === '/') {
      try { window.location.replace('/dashboard'); } catch {}
    }
  }, [appReady, token]);

  
  // Complex dashboard with many interdependent async functions
  // Wrapping all in useCallback would create circular dependencies
  // Safe to disable as these functions are stable and don't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) { refreshUser(); fetchBookings(); fetchGoogleStatus(); fetchBillingLogs(1, true); fetchArchivedCount(); } }, [token]);

  async function api(path, opts = {}) { const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {}, token ? { Authorization: `Bearer ${token}` } : {}); const res = await fetch(`/api${path}`, { ...opts, headers }); const isJson = (res.headers.get("content-type") || "").includes("application/json"); const body = isJson ? await res.json() : await res.text(); if (!res.ok) throw new Error(body?.error || body || `Request failed: ${res.status}`); return body; }

  async function refreshUser() {
    console.log('[dashboard] refreshing user')
    setDashLoading(true); setDashError("");
    const controller = new AbortController();
    fetchAbort.current = controller;
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
      const req = fetch('/api/user', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const res = await Promise.race([req, timeout]);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load user');
      setUser(data);
      console.log('[dashboard] user loaded', data?.email);
    } catch (e) {
      console.warn('[dashboard] user load failed', e?.message);
      setDashError("We couldn’t load your dashboard. Please refresh or log in again.");
    } finally { setDashLoading(false); }
  }

  async function fetchBillingLogs(page = 1, reset = false) { try { setBLoading(true); const data = await api(`/billing/logs?page=${page}&limit=10`, { method: "GET" }); const list = data?.logs || []; setBLogs(reset ? list : [...bLogs, ...list]); setBPage(data?.page || page); const total = data?.total ?? (reset ? list.length : bLogs.length + list.length); setBHasMore(total > (page * 10)); } catch (e) { console.warn('billing logs load failed', e?.message); } finally { setBLoading(false); } }

  async function handleRegister(e) { e.preventDefault(); try { const data = await fetch(`/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }), }).then((r) => r.json()); if (!data?.token) throw new Error(data?.error || "Registration failed"); localStorage.setItem("book8_token", data.token); localStorage.setItem("book8_user", JSON.stringify(data.user)); setToken(data.token); setUser(data.user); if (data.redirect) { window.location.href = data.redirect; } } catch (err) { alert(err.message); } }

  async function handleLogin(e) { e.preventDefault(); try { const data = await fetch(`/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }), }).then((r) => r.json()); if (!data?.token) throw new Error(data?.error || "Login failed"); localStorage.setItem("book8_token", data.token); localStorage.setItem("book8_user", JSON.stringify(data.user)); setToken(data.token); setUser(data.user); if (data.redirect) { window.location.href = data.redirect; } else { window.location.href = '/dashboard'; } } catch (err) { alert(err.message); } }

  async function requestReset(e) { e.preventDefault(); try { setResetMsg(''); const res = await fetch('/api/auth/reset/request', { method:'POST', headers:{ 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail }) }); const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Failed'); setResetMsg('If an account exists, we emailed a link.'); } catch (err) { setResetMsg('If an account exists, we emailed a link.'); } }

  function handleLogout() { if (fetchAbort.current) try { fetchAbort.current.abort(); } catch {} localStorage.removeItem("book8_token"); localStorage.removeItem("book8_user"); setToken(null); setUser(null); setBookings([]); setBLogs([]); }

  async function fetchBookings() { try { setLoadingBookings(true); const list = await api(`/bookings`, { method: "GET" }); setBookings(list || []); } catch (err) { console.error("fetchBookings", err); } finally { setLoadingBookings(false); } }

  async function createBooking(e) { e.preventDefault(); try { const payload = { title, customerName, startTime: startTime ? new Date(startTime).toISOString() : null, endTime: endTime ? new Date(endTime).toISOString() : null, notes, timeZone, }; const created = await api(`/bookings`, { method: "POST", headers: { "x-client-timezone": timeZone }, body: JSON.stringify(payload), }); setTitle("Intro call"); setCustomerName(""); setStartTime(""); setEndTime(""); setNotes(""); await fetchBookings(); alert(`Booking created: ${created?.title || created?.id}`); } catch (err) { alert(err.message); } }

  async function cancelBooking(id) { if (!confirm("Cancel this booking?")) return; try { await api(`/bookings/${id}`, { method: "DELETE" }); await fetchBookings(); } catch (err) { alert(err.message); } }

  async function archiveBookings() {
    if (!confirm("Archive all completed and canceled bookings?")) return;
    try {
      const result = await api(`/bookings/archive`, { method: "POST" });
      alert(`Archived ${result.archived || 0} booking(s)`);
      await fetchBookings();
      await fetchArchivedCount();
    } catch (err) { alert(err.message); }
  }

  async function fetchArchivedCount() {
    try {
      const items = await api(`/bookings/archived`, { method: "GET" });
      setArchivedCount((items || []).length);
    } catch (err) { console.error("fetchArchivedCount", err); }
  }

  function copyBookingLink() {
    if (!user?.scheduling?.handle) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/b/${user.scheduling.handle}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => alert('Failed to copy: ' + err.message));
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

  async function fetchGoogleStatus() { try { const status = await api(`/integrations/google/sync`, { method: "GET" }); setGoogleStatus(status || { connected: false, lastSyncedAt: null }); } catch (err) { setGoogleStatus({ connected: false, lastSyncedAt: null }); } }
  async function connectGoogle() { if (!token) return alert("Please login first"); window.location.href = `/api/integrations/google/auth?jwt=${token}`; }
  async function openCalendars() { try { const res = await api(`/integrations/google/calendars`, { method: "GET" }); setCalendars(res?.calendars || []); setCalendarDialogOpen(true); } catch (err) { alert(err.message || "Failed to load calendars"); } }
  async function saveCalendars() { try { setSavingCalendars(true); const selected = calendars.filter((c) => c.selected).map((c) => c.id); await api(`/integrations/google/calendars`, { method: "POST", body: JSON.stringify({ selectedCalendarIds: selected }), }); setCalendarDialogOpen(false); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Failed to save selections"); } finally { setSavingCalendars(false); } }
  async function syncGoogle() { try { const res = await api(`/integrations/google/sync`, { method: "POST" }); alert(`Synced: created=${res.created}, updated=${res.updated}, deleted=${res.deleted}`); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Sync failed"); } }

  async function doSearch() { try { setSearchLoading(true); const res = await fetch(`/api/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery, maxResults: 5 }), }).then((r) => r.json()); setSearchResults(res); } catch (err) { setSearchResults({ ok: false, error: err.message }); } finally { setSearchLoading(false); } }
  async function doAssistant() { try { setAssistantLoading(true); const ctx = assistantContext ? JSON.parse(assistantContext) : {}; const res = await fetch(`/api/search/booking-assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: assistantPrompt, context: ctx }), }).then((r) => r.json()); setAssistantResults(res); } catch (err) { setAssistantResults({ ok: false, error: err.message }); } finally { setAssistantLoading(false); } }

  // Prevent SSR-first render from showing logged-out hero when user is already logged in (token in localStorage)
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
      <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Navigation */}
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image 
                src="https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png" 
                alt="Book8 AI Logo" 
                width={120}
                height={40}
                priority
                className="h-10 w-auto"
              />
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle resolved={resolved} setTheme={setTheme} />
              <Button variant="ghost" onClick={() => setAuthMode("login")}>Sign In</Button>
              <Button className="gradient-primary text-white" onClick={() => setAuthMode("register")}>Get Started</Button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="container mx-auto max-w-7xl px-6 pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                🤖 AI-Powered Scheduling
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Intelligent Booking <span className="text-gradient">& Automation</span>
              </h1>
              <p className="text-xl text-muted-foreground">
                Transform your scheduling with AI-powered automation. Connect calendars, enable voice bookings, and leverage real-time web search—all in one platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" className="gradient-primary text-white text-lg px-8 btn-glow" onClick={() => setAuthMode("register")}>
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 border-2">
                  Watch Demo →
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-accent" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-accent" />
                  <span>Free 14-day trial</span>
                </div>
              </div>
            </div>
            <div className="relative logo-container">
              <div className="absolute inset-0 gradient-hero rounded-3xl blur-3xl"></div>
              <Image 
                src="https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png" 
                alt="Book8 AI Platform" 
                width={420}
                height={420}
                priority
                className="relative z-10 w-full max-w-[420px] h-auto mx-auto lg:ml-auto animate-float animate-neural-pulse"
                sizes="(min-width: 1024px) 420px, 60vw"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto max-w-7xl px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful features to streamline your scheduling and boost productivity
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: "🗓️", title: "Smart Calendar Sync", desc: "Two-way Google Calendar integration with timezone awareness" },
              { icon: "🔍", title: "Live Web Search", desc: "Real-time venue and booking information powered by Tavily AI" },
              { icon: "📞", title: "Voice Booking", desc: "OpenAI Realtime Audio for natural voice-based scheduling" },
              { icon: "💳", title: "Stripe Billing", desc: "Secure subscription management and payment processing" },
              { icon: "🔗", title: "Public Booking Links", desc: "Shareable links with QR codes for easy client booking" },
              { icon: "⚡", title: "Workflow Automation", desc: "n8n integration for custom scheduling workflows" }
            ].map((feature, i) => (
              <Card key={i} className="border-2 hover:border-primary transition-all duration-300 hover:shadow-lg">
                <CardContent className="pt-6 space-y-4">
                  <div className="text-4xl">{feature.icon}</div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Auth Section */}
        <section className="container mx-auto max-w-4xl px-6 py-20">
          <Card className="bg-card shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl text-center">{authMode === "login" ? "Welcome Back" : "Create Your Account"}</CardTitle>
            </CardHeader>
            <CardContent>
              {!showReset ? (
                <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
                  {authMode !== "login" && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button type="submit">{authMode === "login" ? "Login" : "Register"}</Button>
                    <Button type="button" variant="secondary" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Need an account? Register" : "Have an account? Login"}</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowReset(true)}>Forgot password?</Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={requestReset} className="space-y-3">
                  <div className="space-y-1"><Label>Email</Label><Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" required /></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button type="submit">Send reset link</Button>
                    <Button type="button" variant="secondary" onClick={() => { setShowReset(false); setResetMsg(''); }}>Back to login</Button>
                    {resetMsg && <span className="text-xs text-muted-foreground break-all">{resetMsg}</span>}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto max-w-7xl px-6 py-20 bg-muted/30">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the plan that fits your needs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              { 
                name: "Starter", 
                price: "$9", 
                period: "/month",
                features: ["Basic bookings", "Email notifications", "Mobile responsive", "Email support"],
                popular: false
              },
              { 
                name: "Growth", 
                price: "$29", 
                period: "/month",
                features: ["Everything in Starter", "Google Calendar sync", "Live web search", "QR code sharing", "Priority support"],
                popular: true
              },
              { 
                name: "Enterprise", 
                price: "Custom", 
                period: "",
                features: ["Everything in Growth", "Dedicated support", "SLA guarantee", "Custom workflows", "n8n integration", "White-label option"],
                popular: false
              },
            ].map((plan) => (
              <Card key={plan.name} className={`relative border-2 ${plan.popular ? 'border-primary shadow-2xl scale-105' : 'border-border'} transition-all duration-300 hover:shadow-xl`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="gradient-primary text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</span>
                  </div>
                )}
                <CardHeader className="text-center pb-8 pt-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className={`w-full ${plan.popular ? 'gradient-primary text-white' : ''}`} size="lg">
                    {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-card mt-20">
          <div className="container mx-auto max-w-7xl px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div className="col-span-1 md:col-span-2">
                <Image 
                  src="https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png" 
                  alt="Book8 AI" 
                  width={120}
                  height={40}
                  priority
                  style={{ width: 'auto', height: 'auto' }}
                  className="h-10 w-auto mb-4"
                />
                <p className="text-muted-foreground mb-4">Intelligent booking and automation platform powered by AI.</p>
                <div className="flex gap-4">
                  <Button size="icon" variant="ghost"><Share2 className="h-5 w-5" /></Button>
                  <Button size="icon" variant="ghost"><Share2 className="h-5 w-5" /></Button>
                  <Button size="icon" variant="ghost"><Share2 className="h-5 w-5" /></Button>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
                  <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-sm text-muted-foreground">
              <p>© 2025 Book8 AI. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image 
              src="https://customer-assets.emergentagent.com/job_aibook-scheduler/artifacts/t5b2dg01_Book8-Agent-Logo.png" 
              alt="Book8 AI" 
              width={120}
              height={40}
              priority
              style={{ width: 'auto', height: 'auto' }}
              className="h-10 w-auto"
            />
            <div className="hidden md:block h-6 w-px bg-border"></div>
            <span className="hidden md:inline text-sm text-muted-foreground">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle resolved={resolved} setTheme={setTheme} />
            <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">{user?.email}</span>
            <Button variant="destructive" size="sm" onClick={handleLogout}>Logout</Button>
          </div>

      {/* Compact header for authenticated users, marketing hero otherwise */}
      {isAuthed ? (
        <div className="container mx-auto max-w-7xl px-6 mt-4">
          <div className="flex items-center gap-3 mb-6">
            <Image src="/logo-mark.png" alt="Book8 AI" width={40} height={40} priority className="rounded-xl" />
            <h1 className="text-xl font-semibold">Book8 AI</h1>
          </div>
        </div>
      ) : (
        <section className="container mx-auto max-w-7xl px-6 pt-6">
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-2xl bg-muted/20 p-4">
              <Image src="/hero-book8.png" alt="Book8-AI" width={1200} height={1200} priority sizes="(max-width: 768px) 100vw, 768px" className="w-full h-auto max-h-96 object-contain mx-auto" />
            </div>
          </div>
        </section>
      )}

        </div>
      </header>

      <div className="container mx-auto max-w-7xl p-6">

      {/* Top grid to avoid overlap */}
      <div className="grid lg:grid-cols-[1fr,360px] gap-6 items-start mb-6">
        <div>{/* left reserved for main content lead-in if needed */}</div>
        <div>{/* right reserved for sidebar cards header space */}</div>
      </div>

      {dashLoading && (<div className="mt-4 text-sm text-muted-foreground">Loading dashboard...</div>)}
      {dashError && (<div className="mt-4 text-sm text-red-600">{dashError}</div>)}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Booking */}
        <Card className="lg:col-span-2 bg-card">
          <CardHeader><CardTitle>Create Booking</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="customer">Customer</Label><Input id="customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="start">Start</Label><Input id="start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="end">End</Label><Input id="end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="space-y-2"><Label>Time Zone</Label>
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger><SelectValue placeholder="Choose timezone" /></SelectTrigger>
                  <SelectContent>
                    {["UTC","America/New_York","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Singapore"].map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Auto-detected: {detectedTz}</p>
              </div>
              <div className="md:col-span-2 flex gap-3"><Button type="submit">Create</Button><Button type="button" variant="secondary" onClick={fetchBookings}>Refresh</Button></div>
            </form>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="bg-card">
          <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Google Calendar</p>
                    <p className="text-xs text-muted-foreground break-words">{googleStatus?.connected ? `Connected • Last synced ${googleStatus?.lastSyncedAt ? formatDT(googleStatus.lastSyncedAt) : "never"}` : "Not connected"}</p>
                  </div>
                  <Button size="sm" variant={googleStatus?.connected ? "secondary" : "default"} onClick={connectGoogle} className="shrink-0">{googleStatus?.connected ? "Reconnect" : "Connect"}</Button>
                </div>
                {googleStatus?.connected && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={openCalendars}>Choose calendars</Button>
                    <Button size="sm" onClick={syncGoogle}>Sync now</Button>
                  </div>
                )}
              </div>
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

            {/* Public Booking Link */}
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
                    <Button size="sm" onClick={copyBookingLink} className="gap-2">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowQR(!showQR)} className="gap-2">
                      <QrCode className="h-4 w-4" />
                      {showQR ? 'Hide QR' : 'Show QR'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareBookingLink('twitter')} className="gap-2">
                      <Share2 className="h-3 w-3" />
                      Twitter
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareBookingLink('linkedin')} className="gap-2">
                      <Share2 className="h-3 w-3" />
                      LinkedIn
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareBookingLink('email')} className="gap-2">
                      <Share2 className="h-3 w-3" />
                      Email
                    </Button>
                  </div>
                  
                  {showQR && (
                    <div className="flex justify-center p-4 bg-white rounded-md">
                      <QRCodeSVG 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${user.scheduling.handle}`}
                        size={160}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  )}
                  
                  <a 
                    href={`/b/${user.scheduling.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Preview booking page <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Set up your public booking page to accept bookings from anyone.</p>
                  <Button size="sm" onClick={() => window.location.href = '/dashboard/settings/scheduling'}>
                    Configure Scheduling
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-md border p-3">
              <p className="font-medium">Billing</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between border rounded p-2"><div><p className="font-medium">Starter</p><p className="text-xs text-muted-foreground">$9/mo • Basic bookings</p></div><Button size="sm" variant="secondary">Choose</Button></div>
                <div className="flex items-center justify-between border rounded p-2"><div><p className="font-medium">Growth</p><p className="text-xs text-muted-foreground">$29/mo • Google Calendar + Web Search</p></div><Button size="sm">Choose</Button></div>
                <div className="flex items-center justify-between border rounded p-2"><div><p className="font-medium">Enterprise</p><p className="text-xs text-muted-foreground">Contact us • Custom workflows</p></div><Button size="sm" variant="secondary">Contact</Button></div>
              </div>
            </div>

            {/* Billing Activity Logs (User) */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2"><p className="font-medium">Billing Activity</p><div className="text-xs text-muted-foreground">Latest events</div></div>
              <div className="rounded border overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Date/Time</TableHead><TableHead>Event</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(bLogs || []).length === 0 && !bLoading && (<TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No billing activity yet.</TableCell></TableRow>)}
                    {(bLogs || []).map((l) => (
                      <TableRow key={l.id}><TableCell className="whitespace-nowrap">{formatDT(l.createdAt || l.processedAt)}</TableCell><TableCell className="text-xs">{l.type}</TableCell><TableCell>{toAmount(l) || '-'}</TableCell><TableCell><StatusBadge status={l.status} /></TableCell></TableRow>
                    ))}
                    {bLoading && (<TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Loading...</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex justify-end">{bHasMore ? (<Button size="sm" variant="secondary" onClick={() => fetchBillingLogs(bPage + 1)} disabled={bLoading}>{bLoading ? 'Loading...' : 'Load more'}</Button>) : (<span className="text-xs text-muted-foreground">No more events</span>)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List & AI Search */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Bookings</CardTitle>
              <div className="flex items-center gap-2">
                {archivedCount > 0 && (
                  <span className="text-xs text-muted-foreground">{archivedCount} archived</span>
                )}
                <Button size="sm" variant="outline" onClick={archiveBookings}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBookings ? (<p className="text-sm text-muted-foreground">Loading...</p>) : (
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Customer</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(bookings || []).map((b) => (
                    <TableRow key={b.id}><TableCell>{b.title}</TableCell><TableCell>{b.customerName}</TableCell><TableCell>{formatDT(b.startTime)}</TableCell><TableCell>{formatDT(b.endTime)}</TableCell><TableCell>{b.status}</TableCell><TableCell className="text-right"><Button size="sm" variant="destructive" onClick={() => cancelBooking(b.id)} disabled={b.status === 'canceled'}>Cancel</Button></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Analytics Dashboard */}
        <AnalyticsDashboard token={token} />

        <Card className="bg-card">
          <CardHeader><CardTitle>AI Web Search</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <TabsList className="mb-2"><TabsTrigger value="general">General</TabsTrigger><TabsTrigger value="assistant">Booking Assistant</TabsTrigger></TabsList>
              <TabsContent value="general">
                <div className="space-y-2">
                  <Label>Query</Label>
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search the web..." />
                  <div className="flex gap-2"><Button onClick={doSearch} disabled={searchLoading || !searchQuery}>{searchLoading ? "Searching..." : "Search"}</Button><Button variant="secondary" onClick={() => setSearchResults(null)}>Clear</Button></div>
                  {searchResults && (<pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(searchResults, null, 2)}</pre>)}
                </div>
              </TabsContent>
              <TabsContent value="assistant">
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea value={assistantPrompt} onChange={(e) => setAssistantPrompt(e.target.value)} placeholder="Find venues in NYC for 20 people next Friday..." />
                  <Label>Context (JSON)</Label>
                  <Textarea value={assistantContext} onChange={(e) => setAssistantContext(e.target.value)} placeholder='{"location":"NYC","date":"2025-06-28"}' />
                  <div className="flex gap-2"><Button onClick={doAssistant} disabled={assistantLoading || !assistantPrompt}>{assistantLoading ? "Thinking..." : "Run"}</Button><Button variant="secondary" onClick={() => setAssistantResults(null)}>Clear</Button></div>
                  {assistantResults && (<pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(assistantResults, null, 2)}</pre>)}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
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
