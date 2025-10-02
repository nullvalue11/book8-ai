"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage({ searchParams }) {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const e = sp.get('email') || ''
      const t = sp.get('token') || ''
      if (e) setEmail(e)
      if (t) setToken(t)
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!email || !token || !password || !confirm) {
      setMessage('All fields required')
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match')
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Reset failed')
      setMessage('Password updated! You can now login.')
    } catch (err) {
      setMessage(err.message)
    } finally { setLoading(false) }
  }

  return (
    <main className="container mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Token</Label>
              <Input value={token} onChange={e => setToken(e.target.value)} placeholder="Paste reset token" />
            </div>
            <div className="space-y-1">
              <Label>New password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update password'}</Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
