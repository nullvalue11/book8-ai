"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }
function centsToAmount(obj) {
  const o = obj?.rawEvent?.data?.object || {};
  const currency = (o.currency || o.lines?.data?.[0]?.price?.currency || "usd").toUpperCase();
  const cent = o.amount_paid ?? o.amount_due ?? o.amount ?? o.total ?? null;
  if (cent == null) return { text: "-" };
  return { text: `${(cent / 100).toFixed(2)} ${currency}` };
}
function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (["paid","succeeded","active","completed"].some(x => s.includes(x))) return <Badge className="bg-green-600">success</Badge>;
  if (["failed","past_due","canceled","unpaid"].some(x => s.includes(x))) return <Badge className="bg-red-600">failed</Badge>;
  return <Badge className="bg-yellow-500 text-black">pending</Badge>;
}

export default function AdminBillingLogsPage() {
  const [token, setToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Filters supported by backend
  const [customerId, setCustomerId] = useState("");
  const [plan, setPlan] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Client-side extra filters (event type, status)
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("book8_token");
    if (t) setToken(t);
  }, []);

  async function fetchAdminLogs(pg = 1) {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(pg));
      params.set("limit", String(limit));
      if (customerId) params.set("customerId", customerId);
      if (plan) params.set("plan", plan);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/admin/billing/logs?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load admin billing logs");
      setLogs(data.logs || []);
      setPage(data.page || pg);
      setTotal(data.total || 0);
    } catch (e) {
      alert(e.message);
    } finally { setLoading(false); }
  }

  // fetchAdminLogs is stable and defined in component scope; including it in deps can re-trigger fetch loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) fetchAdminLogs(1); }, [token]);

  const filtered = useMemo(() => {
    return (logs || []).filter(l => {
      if (eventFilter && !(l?.type || "").includes(eventFilter)) return false;
      if (statusFilter && !(String(l?.status || "").toLowerCase().includes(statusFilter))) return false;
      return true;
    });
  }, [logs, eventFilter, statusFilter]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <main className="container mx-auto max-w-7xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin • Billing Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
            <div className="space-y-1 md:col-span-2">
              <Label>Customer ID</Label>
              <Input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="cus_..." />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Plan (price id)</Label>
              <Input value={plan} onChange={e => setPlan(e.target.value)} placeholder="price_..." />
            </div>
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Event contains</Label>
              <Input value={eventFilter} onChange={e => setEventFilter(e.target.value)} placeholder="invoice, subscription..." />
            </div>
            <div className="space-y-1">
              <Label>Status contains</Label>
              <Input value={statusFilter} onChange={e => setStatusFilter(e.target.value)} placeholder="paid, failed, active..." />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => fetchAdminLogs(1)} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</Button>
              <Button variant="secondary" onClick={() => { setCustomerId(''); setPlan(''); setFrom(''); setTo(''); setEventFilter(''); setStatusFilter(''); fetchAdminLogs(1); }}>Reset</Button>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>User/Customer</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stripe Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No matching logs found.</TableCell></TableRow>
                )}
                {filtered.map((l) => {
                  const amt = centsToAmount(l).text;
                  const obj = l?.rawEvent?.data?.object || {};
                  const invoiceId = obj?.invoice || (l?.type?.startsWith('invoice.') ? obj?.id : null);
                  const subId = l?.subscriptionId || (l?.type?.includes('subscription') ? obj?.id : null);
                  const refUrl = invoiceId ? `https://dashboard.stripe.com/test/invoices/${invoiceId}` : (l?.eventId ? `https://dashboard.stripe.com/test/events/${l.eventId}` : null);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{formatDT(l.createdAt || l.processedAt)}</TableCell>
                      <TableCell className="text-xs">{l.customerId || '-'}</TableCell>
                      <TableCell className="text-xs">{l.type}</TableCell>
                      <TableCell>{amt}</TableCell>
                      <TableCell>{statusBadge(l.status)}</TableCell>
                      <TableCell className="text-xs">
                        {refUrl ? <a href={refUrl} target="_blank" className="underline">{invoiceId || subId || l.eventId}</a> : (invoiceId || subId || l.eventId || '-')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">Page {page} of {totalPages} • Total {total}</div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => { const p = Math.max(1, page-1); setPage(p); fetchAdminLogs(p); }}>Prev</Button>
              <Button variant="secondary" disabled={page >= totalPages || loading} onClick={() => { const p = Math.min(totalPages, page+1); setPage(p); fetchAdminLogs(p); }}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
