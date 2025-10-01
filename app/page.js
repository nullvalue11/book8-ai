"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function formatDT(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}
function toAmount(obj) {
  const o = obj?.rawEvent?.data?.object || {};
  const currency = (o.currency || o.lines?.data?.[0]?.price?.currency || "usd").toUpperCase();
  const cent = o.amount_paid ?? o.amount_due ?? o.amount ?? o.total ?? null;
  if (cent == null) return null;
  return `${(cent / 100).toFixed(2)} ${currency}`;
}
function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  if (["paid","succeeded","active","completed"].some(x => s.includes(x))) return <Badge className="bg-green-600">success</Badge>;
  if (["failed","past_due","canceled","unpaid"].some(x => s.includes(x))) return <Badge className="bg-red-600">failed</Badge>;
  return <Badge className="bg-yellow-500 text-black">pending</Badge>;
}

export default function Home() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [title, setTitle] = useState("Intro call");
  const [customerName, setCustomerName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const detectedTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }, []);
  const [timeZone, setTimeZone] = useState(detectedTz);

  // Google Integrations state
  const [googleStatus, setGoogleStatus] = useState({ connected: false, lastSyncedAt: null });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [savingCalendars, setSavingCalendars] = useState(false);

  // Tavily search UI
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantContext, setAssistantContext] = useState("");
  const [assistantResults, setAssistantResults] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);

  // Billing logs (user)
  const [bLogs, setBLogs] = useState([]);
  const [bPage, setBPage] = useState(1);
  const [bHasMore, setBHasMore] = useState(true);
  const [bLoading, setBLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("book8_token");
    const u = localStorage.getItem("book8_user");
    if (t) setToken(t);
    if (u) setUser(JSON.parse(u));
  }, []);

  useEffect(() => {
    if (token) {
      fetchBookings();
      fetchGoogleStatus();
      fetchBillingLogs(1, true);
    }
  }, [token]);

  async function api(path, opts = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {},
      token ? { Authorization: `Bearer ${token}` } : {}
    );
    const res = await fetch(`/api${path}`, { ...opts, headers });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error(body?.error || body || `Request failed: ${res.status}`);
    return body;
  }

  async function fetchBillingLogs(page = 1, reset = false) {
    try {
      setBLoading(true);
      const data = await api(`/billing/logs?page=${page}&limit=10`, { method: "GET" });
      const list = data?.logs || [];
      setBLogs(reset ? list : [...bLogs, ...list]);
      setBPage(data?.page || page);
      const total = data?.total ?? (reset ? list.length : bLogs.length + list.length);
      setBHasMore(total > (page * 10));
    } catch (e) {
      console.warn('billing logs load failed', e?.message);
    } finally { setBLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    try {
      const data = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      }).then((r) => r.json());
      if (!data?.token) throw new Error(data?.error || "Registration failed");
      localStorage.setItem("book8_token", data.token);
      localStorage.setItem("book8_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setEmail(""); setPassword("");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      const data = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).then((r) => r.json());
      if (!data?.token) throw new Error(data?.error || "Login failed");
      localStorage.setItem("book8_token", data.token);
      localStorage.setItem("book8_user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setEmail(""); setPassword("");
    } catch (err) {
      alert(err.message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("book8_token");
    localStorage.removeItem("book8_user");
    setToken(null);
    setUser(null);
    setBookings([]);
    setBLogs([]);
  }

  async function fetchBookings() {
    try {
      setLoadingBookings(true);
      const list = await api(`/bookings`, { method: "GET" });
      setBookings(list || []);
    } catch (err) {
      console.error("fetchBookings", err);
    } finally {
      setLoadingBookings(false);
    }
  }

  async function createBooking(e) {
    e.preventDefault();
    try {
      const payload = {
        title,
        customerName,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        endTime: endTime ? new Date(endTime).toISOString() : null,
        notes,
        timeZone,
      };
      const created = await api(`/bookings`, {
        method: "POST",
        headers: { "x-client-timezone": timeZone },
        body: JSON.stringify(payload),
      });
      setTitle("Intro call"); setCustomerName(""); setStartTime(""); setEndTime(""); setNotes("");
      await fetchBookings();
      alert(`Booking created: ${created?.title || created?.id}`);
    } catch (err) {
      alert(err.message);
    }
  }

  async function cancelBooking(id) {
    if (!confirm("Cancel this booking?")) return;
    try {
      await api(`/bookings/${id}`, { method: "DELETE" });
      await fetchBookings();
    } catch (err) {
      alert(err.message);
    }
  }

  async function fetchGoogleStatus() {
    try {
      const status = await api(`/integrations/google/sync`, { method: "GET" });
      setGoogleStatus(status || { connected: false, lastSyncedAt: null });
    } catch (err) {
      setGoogleStatus({ connected: false, lastSyncedAt: null });
    }
  }

  async function connectGoogle() {
    if (!token) return alert("Please login first");
    window.location.href = `/api/integrations/google/auth?jwt=${token}`;
  }

  async function openCalendars() {
    try {
      const res = await api(`/integrations/google/calendars`, { method: "GET" });
      setCalendars(res?.calendars || []);
      setCalendarDialogOpen(true);
    } catch (err) {
      alert(err.message || "Failed to load calendars");
    }
  }

  async function saveCalendars() {
    try {
      setSavingCalendars(true);
      const selected = calendars.filter((c) => c.selected).map((c) => c.id);
      await api(`/integrations/google/calendars`, {
        method: "POST",
        body: JSON.stringify({ selectedCalendars: selected }),
      });
      setCalendarDialogOpen(false);
    } catch (err) {
      alert(err.message || "Failed to save selections");
    } finally {
      setSavingCalendars(false);
    }
  }

  async function syncGoogle() {
    try {
      const res = await api(`/integrations/google/sync`, { method: "POST" });
      alert(`Synced: created=${res.created}, updated=${res.updated}, deleted=${res.deleted}`);
      await fetchGoogleStatus();
    } catch (err) {
      alert(err.message || "Sync failed");
    }
  }

  async function doSearch() {
    try {
      setSearchLoading(true);
      const res = await fetch(`/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, maxResults: 5 }),
      }).then((r) => r.json());
      setSearchResults(res);
    } catch (err) {
      setSearchResults({ ok: false, error: err.message });
    } finally {
      setSearchLoading(false);
    }
  }

  async function doAssistant() {
    try {
      setAssistantLoading(true);
      const ctx = assistantContext ? JSON.parse(assistantContext) : {};
      const res = await fetch(`/api/search/booking-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: assistantPrompt, context: ctx }),
      }).then((r) => r.json());
      setAssistantResults(res);
    } catch (err) {
      setAssistantResults({ ok: false, error: err.message });
    } finally {
      setAssistantLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="container mx-auto max-w-4xl p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Book8 AI</h1>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{authMode === "login" ? "Login" : "Create Account"}</CardTitle>
            </CardHeader>
            <CardContent>
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
                <div className="flex items-center gap-3">
                  <Button type="submit" className="">{authMode === "login" ? "Login" : "Register"}</Button>
                  <Button type="button" variant="secondary" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>{authMode === "login" ? "Need an account? Register" : "Have an account? Login"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Starter", price: "$9/mo", features: ["Basic bookings", "Email support"] },
                  { name: "Growth", price: "$29/mo", features: ["Google Calendar", "Web Search", "Priority support"] },
                  { name: "Enterprise", price: "Contact", features: ["Dedicated support", "SLA", "Custom workflows"] },
                ].map((p) => (
                  <Card key={p.name} className="border">
                    <CardHeader>
                      <CardTitle>{p.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{p.price}</p>
                      <ul className="mt-3 list-disc ml-5 text-sm text-muted-foreground">
                        {p.features.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-7xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Book8 AI Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Logged in as {user?.email}</span>
          <Button variant="destructive" onClick={handleLogout}>Logout</Button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Booking */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Create Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Input id="customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input id="start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input id="end" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time Zone</Label>
                <Select value={timeZone} onValueChange={setTimeZone}>
                  <SelectTrigger><SelectValue placeholder="Choose timezone" /></SelectTrigger>
                  <SelectContent>
                    {["UTC","America/New_York","America/Los_Angeles","Europe/London","Europe/Paris","Asia/Singapore"].map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Auto-detected: {detectedTz}</p>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <Button type="submit">Create</Button>
                <Button type="button" variant="secondary" onClick={fetchBookings}>Refresh</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-xs text-muted-foreground">{googleStatus?.connected ? `Connected • Last synced ${googleStatus?.lastSyncedAt ? formatDT(googleStatus.lastSyncedAt) : "never"}` : "Not connected"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={googleStatus?.connected ? "secondary" : "default"} onClick={connectGoogle}>{googleStatus?.connected ? "Reconnect" : "Connect"}</Button>
                  <Button size="sm" variant="secondary" onClick={openCalendars} disabled={!googleStatus?.connected}>Choose calendars</Button>
                  <Button size="sm" onClick={syncGoogle} disabled={!googleStatus?.connected}>Sync now</Button>
                </div>
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

            <div className="rounded-md border p-3">
              <p className="font-medium">Billing</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between border rounded p-2">
                  <div>
                    <p className="font-medium">Starter</p>
                    <p className="text-xs text-muted-foreground">$9/mo • Basic bookings</p>
                  </div>
                  <Button size="sm" variant="secondary">Choose</Button>
                </div>
                <div className="flex items-center justify-between border rounded p-2">
                  <div>
                    <p className="font-medium">Growth</p>
                    <p className="text-xs text-muted-foreground">$29/mo • Google Calendar + Web Search</p>
                  </div>
                  <Button size="sm">Choose</Button>
                </div>
                <div className="flex items-center justify-between border rounded p-2">
                  <div>
                    <p className="font-medium">Enterprise</p>
                    <p className="text-xs text-muted-foreground">Contact us • Custom workflows</p>
                  </div>
                  <Button size="sm" variant="secondary">Contact</Button>
                </div>
              </div>
            </div>

            {/* Billing Activity Logs (User) */}
            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Billing Activity</p>
                <div className="text-xs text-muted-foreground">Latest events</div>
              </div>
              <div className="rounded border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(bLogs || []).length === 0 && !bLoading && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No billing activity yet.</TableCell></TableRow>
                    )}
                    {(bLogs || []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{formatDT(l.createdAt || l.processedAt)}</TableCell>
                        <TableCell className="text-xs">{l.type}</TableCell>
                        <TableCell>{toAmount(l) || '-'}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                      </TableRow>
                    ))}
                    {bLoading && (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Loading...</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex justify-end">
                {bHasMore ? (
                  <Button size="sm" variant="secondary" onClick={() => fetchBillingLogs(bPage + 1)} disabled={bLoading}>{bLoading ? 'Loading...' : 'Load more'}</Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No more events</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List & AI Search */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBookings ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bookings || []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.title}</TableCell>
                      <TableCell>{b.customerName}</TableCell>
                      <TableCell>{formatDT(b.startTime)}</TableCell>
                      <TableCell>{formatDT(b.endTime)}</TableCell>
                      <TableCell>{b.status}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="destructive" onClick={() => cancelBooking(b.id)} disabled={b.status === 'canceled'}>
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Web Search</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <TabsList className="mb-2">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="assistant">Booking Assistant</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <div className="space-y-2">
                  <Label>Query</Label>
                  <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search the web..." />
                  <div className="flex gap-2">
                    <Button onClick={doSearch} disabled={searchLoading || !searchQuery}>{searchLoading ? "Searching..." : "Search"}</Button>
                    <Button variant="secondary" onClick={() => setSearchResults(null)}>Clear</Button>
                  </div>
                  {searchResults && (
                    <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(searchResults, null, 2)}
                    </pre>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="assistant">
                <div className="space-y-2">
                  <Label>Prompt</Label>
                  <Textarea value={assistantPrompt} onChange={(e) => setAssistantPrompt(e.target.value)} placeholder="Find venues in NYC for 20 people next Friday..." />
                  <Label>Context (JSON)</Label>
                  <Textarea value={assistantContext} onChange={(e) => setAssistantContext(e.target.value)} placeholder='{"location":"NYC","date":"2025-06-28"}' />
                  <div className="flex gap-2">
                    <Button onClick={doAssistant} disabled={assistantLoading || !assistantPrompt}>{assistantLoading ? "Thinking..." : "Run"}</Button>
                    <Button variant="secondary" onClick={() => setAssistantResults(null)}>Clear</Button>
                  </div>
                  {assistantResults && (
                    <pre className="mt-2 max-h-72 overflow-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(assistantResults, null, 2)}
                    </pre>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
