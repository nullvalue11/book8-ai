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

  // Derive auth for header/hero rendering
  const isAuthed = hasToken; // or derive from stored user if needed

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-[1fr,360px] gap-6 items-start">
          {/* left column: compact header + main content */}
          <div className="lg:col-span-2">
            {isAuthed ? (
              <div className="flex items-center gap-3 mb-6">
                <Image
                  src="/logo-mark.png"
                  alt="Book8 AI"
                  width={40}
                  height={40}
                  priority
                  className="rounded-xl"
                />
                <h1 className="text-xl font-semibold">Book8 AI</h1>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl mb-6">
                <div className="rounded-2xl bg-muted/20 p-4">
                  <Image
                    src="/hero-book8.png"
                    alt="Book8-AI"
                    width={1200}
                    height={1200}
                    priority
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="w-full h-auto max-h-96 object-contain mx-auto"
                  />
                </div>
              </div>
            )}

            <Home forceDashboard hideHeader />
          </div>

          {/* right column: sidebar cards (if any external to Home) */}
          <div />
        </div>
      </div>
    </main>
  );
}
