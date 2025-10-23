"use client";

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export default function HomeClient(props) {
  const forceDashboard = !!props?.forceDashboard
  const hideHeader = !!props?.hideHeader

  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem('book8_token')
        const u = localStorage.getItem('book8_user')
        if (t) setToken(t)
        if (u) setUser(JSON.parse(u))
      }
    } finally { setReady(true) }
  }, [])

  const isAuthed = !!user || !!token || !!forceDashboard

  useEffect(() => {
    if (ready && isAuthed && !forceDashboard && typeof window !== 'undefined') {
      window.location.replace('/dashboard')
    }
  }, [ready, isAuthed, forceDashboard])

  if (!ready) {
    return (
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-5xl px-6 py-10">
          <div className="h-10 w-40 bg-muted rounded mb-6" />
          <div className="h-64 w-full bg-muted rounded" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {!hideHeader && (
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo-mark.svg" alt="Book8 AI" width={32} height={32} priority className="rounded" />
              <span className="font-semibold">Book8 AI</span>
            </div>
            <div className="flex items-center gap-3">
              {!isAuthed && <Button onClick={() => (typeof window !== 'undefined' ? window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) : null)}>Sign In</Button>}
            </div>
          </div>
        </header>
      )}

      <div className="container mx-auto max-w-7xl px-6 py-10">
        {isAuthed ? (
          <div className="flex items-center gap-3 mb-6">
            <Image src="/logo-mark.svg" alt="Book8 AI" width={40} height={40} priority className="rounded-xl" />
            <h1 className="text-xl font-semibold">Book8 AI</h1>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl">
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

        <div className="mt-8 grid lg:grid-cols-[1fr,360px] gap-6 items-start">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Welcome{user?.name ? `, ${user.name}` : ''}</h2>
            <p className="text-muted-foreground">Your AI-powered scheduling assistant.</p>
            {!isAuthed && (
              <div className="flex gap-2">
                <Button onClick={() => alert('Open login modal in full build')}>Sign In</Button>
                <Button variant="secondary" onClick={() => alert('Open register modal in full build')}>Create Account</Button>
              </div>
            )}
          </div>
          <div className="hidden lg:block" />
        </div>
      </div>
    </main>
  )
}
