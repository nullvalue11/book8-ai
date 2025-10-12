"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }
function toAmount(obj) { const o = obj?.rawEvent?.data?.object || {}; const currency = (o.currency || o.lines?.data?.[0]?.price?.currency || "usd").toUpperCase(); const cent = o.amount_paid ?? o.amount_due ?? o.amount ?? o.total ?? null; if (cent == null) return null; return `${(cent / 100).toFixed(2)} ${currency}`; }
function StatusBadge({ status }) { const s = String(status || "").toLowerCase(); if (["paid","succeeded","active","completed"].some(x => s.includes(x))) return <Badge className="bg-green-600">success</Badge>; if (["failed","past_due","canceled","unpaid"].some(x => s.includes(x))) return <Badge className="bg-red-600">failed</Badge>; return <Badge className="bg-yellow-500 text-black">pending</Badge>; }

export default function Home() {
  const { theme, setTheme, systemTheme } = useTheme();
  const resolved = theme === "system" ? systemTheme : theme;
  // ... rest of state and logic remain unchanged

  // existing state & effects omitted for brevity (unchanged)

  return (
    <main className="container mx-auto max-w-7xl p-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Book8 AI Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <ThemeToggle resolved={resolved} setTheme={setTheme} />
        </div>
      </header>
      {/* keep rest of component unchanged */}
    </main>
  );
}

function ThemeToggle({ resolved, setTheme }) {
  return (
    <div className="flex items-center gap-2">
      <button aria-label="Light" className={`p-2 rounded-md border ${resolved === 'light' ? 'bg-secondary' : ''}`} onClick={() => setTheme('light')}>
        <Sun className="h-4 w-4" />
      </button>
      <button aria-label="Dark" className={`p-2 rounded-md border ${resolved === 'dark' ? 'bg-secondary' : ''}`} onClick={() => setTheme('dark')}>
        <Moon className="h-4 w-4" />
      </button>
      <button aria-label="System" className={`p-2 rounded-md border ${resolved !== 'dark' && resolved !== 'light' ? 'bg-secondary' : ''}`} onClick={() => setTheme('system')}>
        Sys
      </button>
    </div>
  );
}
