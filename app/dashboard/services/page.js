"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import HeaderLogo from "@/components/HeaderLogo";
import { ArrowLeft, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import { currencyFromTimezone, detectCurrency, formatPrice } from "@/lib/currency";

function parseOptionalPriceInput(str) {
  if (str == null || String(str).trim() === "") return null;
  const n = parseFloat(String(str).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function generateServiceId(name, durationMinutes) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${durationMinutes}`;
}

function ServicesContent() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [services, setServices] = useState([]);
  const [planLimits, setPlanLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newPrice, setNewPrice] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [businessTimezone, setBusinessTimezone] = useState(null);

  const detectedCurrency = React.useMemo(() => {
    if (businessTimezone) return currencyFromTimezone(businessTimezone);
    return detectCurrency();
  }, [businessTimezone]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("book8_token");
      if (t) setToken(t);
      else router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const bizRes = await fetch("/api/business/register", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const bizData = await bizRes.json();
        if (!bizRes.ok || !bizData.ok || !bizData.businesses?.length) {
          setError("No business found. Register a business first.");
          setLoading(false);
          return;
        }
        const biz = bizData.businesses[0];
        setBusinessId(biz.businessId);
        setBusinessName(biz.name || biz.businessId);
        if (biz.planLimits) {
          setPlanLimits(biz.planLimits);
        }

        const svcRes = await fetch(`/api/business/${biz.businessId}/services`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const svcData = await svcRes.json();
        if (svcRes.ok && svcData.ok && Array.isArray(svcData.services)) {
          setServices(svcData.services);
        } else {
          setServices([]);
        }
      } catch (e) {
        setError(e.message || "Failed to load services");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const maxServices = typeof planLimits?.maxServices === "number" ? planLimits.maxServices : null;
  const hasReachedServiceLimit =
    maxServices != null && maxServices > 0 && services.length >= maxServices;

  function resetServiceForm() {
    setEditingServiceId(null);
    setNewName("");
    setNewDuration(30);
    setNewPrice("");
    setNewActive(true);
  }

  async function handleSaveService(e) {
    e.preventDefault();
    if (!businessId || !newName.trim()) return;
    if (!editingServiceId && hasReachedServiceLimit) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    const pricePayload = parseOptionalPriceInput(newPrice);
    try {
      const editing =
        editingServiceId &&
        services.find((s) => (s.serviceId || s.id) === editingServiceId);
      const currencyForSave = editingServiceId
        ? editing?.currency ?? "USD"
        : detectedCurrency;
      const commonBody = {
        name: newName.trim(),
        durationMinutes: Number(newDuration) || 30,
        active: newActive,
        price: pricePayload,
        currency: currencyForSave
      };

      let res;
      if (editingServiceId) {
        res = await fetch(
          `/api/business/${encodeURIComponent(businessId)}/services/${encodeURIComponent(editingServiceId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(commonBody)
          }
        );
      } else {
        const serviceId = generateServiceId(newName.trim(), newDuration);
        res = await fetch(`/api/business/${businessId}/services`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            serviceId,
            ...commonBody
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (editingServiceId ? "Failed to update service" : "Failed to add service"));
      }
      setSuccessMessage(editingServiceId ? "Service updated." : "Service added successfully.");
      setShowAddForm(false);
      resetServiceForm();
      const listRes = await fetch(`/api/business/${businessId}/services`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      if (listRes.ok && listData.services) setServices(listData.services);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 shrink-0" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground mt-1">
          Your AI assistant offers these services to callers.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              {services.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No services yet. Add one below.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {services.map((s) => {
                    const sid = s.serviceId || s.id;
                    const priceNum =
                      s.price != null && s.price !== "" ? Number(s.price) : NaN;
                    const priceFormatted =
                      Number.isFinite(priceNum)
                        ? formatPrice(priceNum, s.currency || detectedCurrency)
                        : null;
                    return (
                    <li key={sid || s.name} className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.durationMinutes} min
                          {priceFormatted != null ? ` · ${priceFormatted}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowAddForm(true);
                            setEditingServiceId(sid);
                            setNewName(s.name || "");
                            setNewDuration(Number(s.durationMinutes) || 30);
                            setNewPrice(
                              s.price != null && s.price !== "" ? String(s.price) : ""
                            );
                            setNewActive(s.active !== false);
                          }}
                        >
                          Edit
                        </Button>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.active !== false ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {s.active !== false ? <><Check className="w-3 h-3" /> Active</> : "Inactive"}
                        </span>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {!showAddForm ? (
            <div className="space-y-2">
              <Button onClick={() => setShowAddForm(true)} disabled={hasReachedServiceLimit}>
                <Plus className="w-4 h-4 mr-2" /> Add Service
              </Button>
              {hasReachedServiceLimit && (
                <p className="text-xs text-muted-foreground">
                  You&apos;ve reached the maximum services for your plan.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => router.push("/pricing?paywall=1&feature=services")}
                  >
                    Upgrade to add more.
                  </button>
                </p>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{editingServiceId ? "Edit service" : "Add service"}</CardTitle>
                <CardDescription>
                  {`Name, duration, and optional price (${detectedCurrency}).`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveService} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="service-name">Service Name</Label>
                    <Input
                      id="service-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Men's Haircut"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={5}
                      max={480}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value) || 30)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">{`Price (optional, ${detectedCurrency})`}</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="e.g. 45"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="active" checked={newActive} onCheckedChange={setNewActive} />
                    <Label htmlFor="active">Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        resetServiceForm();
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving || !newName.trim()}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {editingServiceId ? "Save changes" : "Save service"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function ServicesPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo className="opacity-90 hover:opacity-100" />
            <div className="hidden md:block h-6 w-px bg-border" />
            <span className="hidden md:inline text-sm text-muted-foreground">Services</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </header>
      <Suspense fallback={<div className="container max-w-4xl p-6"><div className="h-12 w-48 bg-muted rounded animate-pulse" /></div>}>
        <ServicesContent />
      </Suspense>
    </main>
  );
}
