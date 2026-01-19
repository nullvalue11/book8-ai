"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
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

  const missingToken = !token

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    if (missingToken) {
      setMessage('Reset link is invalid or missing. Please request a new one.')
      return
    }
    if (!email || !password || !confirm) {
      setMessage('All fields required')
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match')
      return
    }
    try {
      setLoading(true)
      const res = await fetch('/api/credentials/reset/confirm', {
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

  if (missingToken) {
    return (
      <main className="container mx-auto max-w-md p-6">
        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Your reset link is missing or invalid. For security, please request a new link.</p>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={() => (window.location.href = '/reset-password/request')}>Request new link</Button>
              <Button variant="secondary" onClick={() => (window.location.href = '/')}>Back to login</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {/* Email is shown read-only for clarity */}
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} readOnly disabled />
            </div>
            {/* Hidden token field (kept in state and posted to API) */}
            <input type="hidden" value={token} readOnly />
            <div className="space-y-1">
              <Label>New password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Update password'}</Button>
              <Button type="button" variant="secondary" onClick={() => (window.location.href = '/')}>Back to login</Button>
              {message && <span className="text-sm text-muted-foreground break-all">{message}</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
