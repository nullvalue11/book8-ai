"use client";
import React from "react";
import Image from 'next/image'
import Home from "../page";

export default function DashboardPage() {
  const [mounted, setMounted] = React.useState(false);
  const [hasToken, setHasToken] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem('book8_token') : null;
      setHasToken(!!t);
      if (!t && typeof window !== 'undefined') {
        // Not authenticated — send to marketing/login to avoid SSR/CSR mismatch here
        window.location.replace('/');
      }
    } catch {}
  }, []);

  if (!mounted) {
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

  if (!hasToken) return null; // will redirect to '/'

  return <Home forceDashboard />;
}
