"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
import { QrCode, Share2, Settings, ExternalLink, Check, Moon, Sun } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }

export default function Home(props) {
  const forceDashboard = !!props?.forceDashboard;
  const { theme, setTheme, systemTheme } = useTheme();
  const resolved = theme === "system" ? systemTheme : theme;

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [appReady, setAppReady] = useState(false);

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
  useEffect(() => { if (token) { refreshUser(); fetchBookings(); fetchGoogleStatus(); fetchArchivedCount(); } }, [token]);

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
  async function connectGoogle() { if (!token) return alert("Please login first"); window.location.href = `/api/integrations/google/auth?jwt=${token}`; }
  async function openCalendars() { try { const res = await api(`/integrations/google/calendars`, { method: "GET" }); setCalendars(res?.calendars || []); setCalendarDialogOpen(true); } catch (err) { alert(err.message || "Failed to load calendars"); } }
  async function saveCalendars() { try { setSavingCalendars(true); const selected = calendars.filter((c) => c.selected).map((c) => c.id); await api(`/integrations/google/calendars`, { method: "POST", body: JSON.stringify({ selectedCalendarIds: selected }), }); setCalendarDialogOpen(false); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Failed to save selections"); } finally { setSavingCalendars(false); } }
  async function syncGoogle() { try { const res = await api(`/integrations/google/sync`, { method: "POST" }); alert(`Synced: created=${res.created}, updated=${res.updated}, deleted=${res.deleted}`); await fetchGoogleStatus(); } catch (err) { alert(err.message || "Sync failed"); } }

  function handleLogout() { if (fetchAbort.current) try { fetchAbort.current.abort(); } catch {} localStorage.removeItem("book8_token"); localStorage.removeItem("book8_user"); setToken(null); setUser(null); setBookings([]); }

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
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <Button className="flex-1 bg-brand-500 hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500" onClick={handleLogin}>Sign In</Button>
                <Button className="flex-1 border-white/12 hover:border-white/20 focus-visible:ring-2 focus-visible:ring-brand-500" variant="outline" onClick={handleRegister}>Register</Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo width={152} height={28} className="opacity-90 hover:opacity-100 transition" />
            <div className="hidden md:block h-6 w-px bg-border"></div>
            <span className="hidden md:inline text-sm text-muted-foreground">Dashboard</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle resolved={resolved} setTheme={setTheme} />
            <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">{user?.email}</span>
            <Button variant="destructive" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

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
              <div className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Google Calendar</p>
                    <p className="text-xs text-muted-foreground break-words">{googleStatus?.connected ? `Connected • Last synced ${googleStatus?.lastSyncedAt ? formatDT(googleStatus.lastSyncedAt) : "never"}` : "Not connected"}</p>
                  </div>
                  <Button size="sm" variant={googleStatus?.connected ? "secondary" : "default"} onClick={connectGoogle} className="shrink-0">{googleStatus?.connected ? "Reconnect" : "Connect"}</Button>
                </div>
                {googleStatus?.connected && (
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

          <AnalyticsDashboard token={token} />
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
