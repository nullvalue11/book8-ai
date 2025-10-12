"use client";
import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ResetRequestPage() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    try {
      setLoading(true)
      const res = await fetch('/api/auth/reset/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setMsg('If an account exists, we emailed a link.')
    } catch (err) {
      setMsg('If an account exists, we emailed a link.')
    } finally { setLoading(false) }
  }

  return (
    <main className="container mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</Button>
              <Button type="button" variant="secondary" onClick={() => (window.location.href = '/')}>Back to login</Button>
              {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
