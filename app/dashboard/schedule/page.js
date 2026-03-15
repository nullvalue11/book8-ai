"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import HeaderLogo from "@/components/HeaderLogo";
import { ArrowLeft, Loader2, AlertCircle, Check } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const s = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      opts.push(s);
    }
  }
  return opts;
})();

const TIMEZONES = [
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Edmonton",
  "America/Halifax",
  "America/St_Johns",
  "UTC"
];

function emptyWeeklyHours() {
  return DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {});
}

function ScheduleContent() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [timezone, setTimezone] = useState("America/Toronto");
  const [weeklyHours, setWeeklyHours] = useState(emptyWeeklyHours());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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

        const schedRes = await fetch(`/api/business/${biz.businessId}/schedule`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const schedData = await schedRes.json();
        if (schedRes.ok && schedData.ok && schedData.schedule) {
          setTimezone(schedData.schedule.timezone || "America/Toronto");
          const wh = schedData.schedule.weeklyHours || {};
          setWeeklyHours((prev) => {
            const next = { ...emptyWeeklyHours() };
            DAYS.forEach((d) => {
              next[d] = Array.isArray(wh[d]) ? wh[d] : [];
            });
            return next;
          });
        }
      } catch (e) {
        setError(e.message || "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function setDayOpen(day, open) {
    setWeeklyHours((prev) => ({
      ...prev,
      [day]: open ? [{ start: "09:00", end: "17:00" }] : []
    }));
  }

  function setDayBlock(day, index, field, value) {
    setWeeklyHours((prev) => {
      const blocks = [...(prev[day] || [])];
      if (!blocks[index]) blocks[index] = { start: "09:00", end: "17:00" };
      blocks[index] = { ...blocks[index], [field]: value };
      return { ...prev, [day]: blocks };
    });
  }

  const isDayOpen = (day) => (weeklyHours[day] || []).length > 0;

  async function handleSave() {
    if (!businessId) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/business/${businessId}/schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          timezone,
          weeklyHours: { ...weeklyHours }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save schedule");
      setSuccessMessage("Business hours saved.");
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
        <h1 className="text-2xl font-bold">Business Hours</h1>
        <p className="text-muted-foreground mt-1">
          Set when your AI assistant accepts booking calls.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Hours</CardTitle>
            <CardDescription>Timezone and open hours per day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                className="w-full max-w-xs h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                ))}
              </select>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Day</th>
                    <th className="text-left p-3 font-medium">Open</th>
                    <th className="text-left p-3 font-medium">Close</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => {
                    const open = isDayOpen(day);
                    const blocks = weeklyHours[day] || [];
                    const block = blocks[0] || { start: "09:00", end: "17:00" };
                    return (
                      <tr key={day} className="border-b last:border-0">
                        <td className="p-3 font-medium capitalize">{DAY_LABELS[day]}</td>
                        <td className="p-3">
                          <select
                            className="h-9 rounded border border-input bg-background px-2 text-sm w-24"
                            value={block.start}
                            disabled={!open}
                            onChange={(e) => setDayBlock(day, 0, "start", e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            className="h-9 rounded border border-input bg-background px-2 text-sm w-24"
                            value={block.end}
                            disabled={!open}
                            onChange={(e) => setDayBlock(day, 0, "end", e.target.value)}
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <Switch
                            checked={open}
                            onCheckedChange={(checked) => setDayOpen(day, checked)}
                          />
                          <span className="ml-2 text-muted-foreground">{open ? "Open" : "Closed"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Hours
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo className="opacity-90 hover:opacity-100" />
            <div className="hidden md:block h-6 w-px bg-border" />
            <span className="hidden md:inline text-sm text-muted-foreground">Business Hours</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </header>
      <Suspense fallback={<div className="container max-w-4xl p-6"><div className="h-12 w-48 bg-muted rounded animate-pulse" /></div>}>
        <ScheduleContent />
      </Suspense>
    </main>
  );
}
