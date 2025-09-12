'use client'

import { useEffect, useMemo, useState } from 'react'

function useAuth() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() =&gt; {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('book8_token') : null
    const u = typeof window !== 'undefined' ? window.localStorage.getItem('book8_user') : null
    if (t) setToken(t)
    if (u) try { setUser(JSON.parse(u)) } catch {}
  }, [])

  const login = (t, u) =&gt; {
    setToken(t)
    setUser(u)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('book8_token', t)
      window.localStorage.setItem('book8_user', JSON.stringify(u))
    }
  }

  const logout = () =&gt; {
    setToken(null)
    setUser(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('book8_token')
      window.localStorage.removeItem('book8_user')
    }
  }

  return { token, user, login, logout }
}

const Header = ({ user, onLogout }) =&gt; {
  return (
    &lt;div className="w-full border-b border-border bg-card"&gt;
      &lt;div className="container py-4 flex items-center justify-between"&gt;
        &lt;div className="flex items-center gap-3"&gt;
          &lt;img className="h-8 w-8 rounded" src="https://avatars.githubusercontent.com/in/1201222?s=120&amp;u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&amp;v=4" alt="Book8" /&gt;
          &lt;div className="font-semibold"&gt;Book8 AI&lt;/div&gt;
        &lt;/div&gt;
        &lt;div className="text-sm text-muted-foreground"&gt;
          {user ? (
            &lt;div className="flex items-center gap-3"&gt;
              &lt;span&gt;{user?.email}&lt;/span&gt;
              &lt;button onClick={onLogout} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90"&gt;Logout&lt;/button&gt;
            &lt;/div&gt;
          ) : (
            &lt;span&gt;MVP Demo&lt;/span&gt;
          )}
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

const AuthCard = ({ onAuth }) =&gt; {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const title = mode === 'login' ? 'Sign in' : 'Create your account'

  const submit = async (e) =&gt; {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onAuth(data.token, data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    &lt;div className="max-w-md mx-auto bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6"&gt;
      &lt;div className="text-center mb-4"&gt;
        &lt;h2 className="text-xl font-semibold"&gt;{title}&lt;/h2&gt;
        &lt;p className="text-sm text-muted-foreground"&gt;JWT auth with MongoDB&lt;/p&gt;
      &lt;/div&gt;
      &lt;form onSubmit={submit} className="space-y-3"&gt;
        {mode === 'register' &amp;&amp; (
          &lt;div className="space-y-1"&gt;
            &lt;label className="text-sm"&gt;Name&lt;/label&gt;
            &lt;input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" value={name} onChange={(e) =&gt; setName(e.target.value)} placeholder="Jane Doe" /&gt;
          &lt;/div&gt;
        )}
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;Email&lt;/label&gt;
          &lt;input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" type="email" value={email} onChange={(e) =&gt; setEmail(e.target.value)} placeholder="you@company.com" required /&gt;
        &lt;/div&gt;
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;Password&lt;/label&gt;
          &lt;input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" type="password" value={password} onChange={(e) =&gt; setPassword(e.target.value)} placeholder="••••••••" required /&gt;
        &lt;/div&gt;
        {error ? &lt;div className="text-sm text-destructive"&gt;{error}&lt;/div&gt; : null}
        &lt;button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60"&gt;
          {loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
        &lt;/button&gt;
      &lt;/form&gt;
      &lt;div className="text-center mt-3 text-sm"&gt;
        {mode === 'login' ? (
          &lt;button onClick={() =&gt; setMode('register')} className="text-foreground/80 hover:underline"&gt;New here? Create an account&lt;/button&gt;
        ) : (
          &lt;button onClick={() =&gt; setMode('login')} className="text-foreground/80 hover:underline"&gt;Already have an account? Sign in&lt;/button&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

const BookingForm = ({ token, onCreated }) =&gt; {
  const [title, setTitle] = useState('Intro call')
  const [customerName, setCustomerName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) =&gt; {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, customerName, startTime, endTime, notes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onCreated(data)
      setCustomerName(''); setNotes('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    &lt;div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4"&gt;
      &lt;h3 className="font-semibold mb-2"&gt;Create booking&lt;/h3&gt;
      &lt;form onSubmit={submit} className="grid md:grid-cols-2 gap-3"&gt;
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;Title&lt;/label&gt;
          &lt;input className="w-full rounded-md border border-border bg-background px-3 py-2" value={title} onChange={(e) =&gt; setTitle(e.target.value)} /&gt;
        &lt;/div&gt;
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;Customer name&lt;/label&gt;
          &lt;input className="w-full rounded-md border border-border bg-background px-3 py-2" value={customerName} onChange={(e) =&gt; setCustomerName(e.target.value)} /&gt;
        &lt;/div&gt;
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;Start time&lt;/label&gt;
          &lt;input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={startTime} onChange={(e) =&gt; setStartTime(e.target.value)} required /&gt;
        &lt;/div&gt;
        &lt;div className="space-y-1"&gt;
          &lt;label className="text-sm"&gt;End time&lt;/label&gt;
          &lt;input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={endTime} onChange={(e) =&gt; setEndTime(e.target.value)} required /&gt;
        &lt;/div&gt;
        &lt;div className="md:col-span-2 space-y-1"&gt;
          &lt;label className="text-sm"&gt;Notes&lt;/label&gt;
          &lt;textarea className="w-full rounded-md border border-border bg-background px-3 py-2" rows={2} value={notes} onChange={(e) =&gt; setNotes(e.target.value)} /&gt;
        &lt;/div&gt;
        &lt;div className="md:col-span-2"&gt;
          &lt;button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60"&gt;
            {loading ? 'Saving…' : 'Save booking'}
          &lt;/button&gt;
        &lt;/div&gt;
      &lt;/form&gt;
      {error ? &lt;p className="mt-2 text-sm text-destructive"&gt;{error}&lt;/p&gt; : null}
    &lt;/div&gt;
  )
}

const BookingsTable = ({ token, items, refresh }) =&gt; {
  const cancelBooking = async (id) =&gt; {
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    await res.json()
    refresh()
  }

  return (
    &lt;div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm"&gt;
      &lt;div className="p-4 border-b border-border flex items-center justify-between"&gt;
        &lt;h3 className="font-semibold"&gt;Your bookings&lt;/h3&gt;
        &lt;button onClick={refresh} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90"&gt;Refresh&lt;/button&gt;
      &lt;/div&gt;
      &lt;div className="overflow-x-auto"&gt;
        &lt;table className="w-full text-sm"&gt;
          &lt;thead className="bg-muted/50"&gt;
            &lt;tr&gt;
              &lt;th className="text-left p-3"&gt;Title&lt;/th&gt;
              &lt;th className="text-left p-3"&gt;Customer&lt;/th&gt;
              &lt;th className="text-left p-3"&gt;Start&lt;/th&gt;
              &lt;th className="text-left p-3"&gt;End&lt;/th&gt;
              &lt;th className="text-left p-3"&gt;Status&lt;/th&gt;
              &lt;th className="text-left p-3"&gt;Actions&lt;/th&gt;
            &lt;/tr&gt;
          &lt;/thead&gt;
          &lt;tbody&gt;
            {(items || []).length === 0 ? (
              &lt;tr&gt;
                &lt;td className="p-3 text-muted-foreground" colSpan={6}&gt;No bookings yet&lt;/td&gt;
              &lt;/tr&gt;
            ) : (
              (items || []).map((b) =&gt; (
                &lt;tr key={b?.id}&gt;
                  &lt;td className="p-3"&gt;{b?.title}&lt;/td&gt;
                  &lt;td className="p-3"&gt;{b?.customerName || '—'}&lt;/td&gt;
                  &lt;td className="p-3"&gt;{new Date(b?.startTime).toLocaleString()}&lt;/td&gt;
                  &lt;td className="p-3"&gt;{new Date(b?.endTime).toLocaleString()}&lt;/td&gt;
                  &lt;td className="p-3"&gt;
                    &lt;span className={`px-2 py-0.5 rounded text-xs ${b?.status === 'canceled' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}&gt;
                      {b?.status}
                    &lt;/span&gt;
                  &lt;/td&gt;
                  &lt;td className="p-3"&gt;
                    {b?.status !== 'canceled' ? (
                      &lt;button className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90" onClick={() =&gt; cancelBooking(b?.id)}&gt;Cancel&lt;/button&gt;
                    ) : (
                      &lt;span className="text-muted-foreground"&gt;—&lt;/span&gt;
                    )}
                  &lt;/td&gt;
                &lt;/tr&gt;
              ))
            )}
          &lt;/tbody&gt;
        &lt;/table&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  )
}

const Dashboard = ({ token, user, onLogout }) =&gt; {
  const [items, setItems] = useState([])
  const load = async () =&gt; {
    if (!token) return
    const res = await fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) setItems(Array.isArray(data) ? data : [])
  }
  useEffect(() =&gt; { load() }, [token])

  return (
    &lt;div&gt;
      &lt;Header user={user} onLogout={onLogout} /&gt;
      &lt;main className="container py-6 grid gap-6 md:grid-cols-5"&gt;
        &lt;div className="md:col-span-2"&gt;
          &lt;BookingForm token={token} onCreated={() =&gt; load()} /&gt;
          &lt;div className="mt-6 grid gap-3"&gt;
            &lt;button className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted" onClick={async () =&gt; {
              const r = await fetch('/api/integrations/google/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
              const d = await r.json(); alert(d?.message || 'Synced (stub)')
            }}&gt;Sync Google Calendar (stub)&lt;/button&gt;
            &lt;button className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted" onClick={async () =&gt; {
              const r = await fetch('/api/integrations/voice/call', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
              const d = await r.json(); alert(d?.message || 'Voice (stub)')
            }}&gt;Test Voice Call (stub)&lt;/button&gt;
            &lt;button className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted" onClick={async () =&gt; {
              const r = await fetch('/api/integrations/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ q: 'business hours' }) })
              const d = await r.json(); alert(d?.note || 'Search (stub)')
            }}&gt;Web Search (stub)&lt;/button&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        &lt;div className="md:col-span-3"&gt;
          &lt;BookingsTable token={token} items={items} refresh={load} /&gt;
        &lt;/div&gt;
      &lt;/main&gt;
    &lt;/div&gt;
  )
}

const Home = () =&gt; {
  const { token, user, login, logout } = useAuth()
  return (
    &lt;div className="min-h-screen bg-background text-foreground"&gt;
      {token ? (
        &lt;Dashboard token={token} user={user} onLogout={logout} /&gt;
      ) : (
        &lt;div&gt;
          &lt;Header /&gt;
          &lt;main className="container py-10"&gt;
            &lt;div className="max-w-2xl mx-auto text-center mb-8"&gt;
              &lt;h1 className="text-3xl font-bold"&gt;Book8 AI&lt;/h1&gt;
              &lt;p className="text-muted-foreground mt-2"&gt;Scheduling, voice, and web search — wired with a modular workflow engine. Start by creating your account.&lt;/p&gt;
            &lt;/div&gt;
            &lt;AuthCard onAuth={login} /&gt;
          &lt;/main&gt;
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  )
}

function App() {
  return (
    &lt;div className="App"&gt;
      &lt;Home /&gt;
    &lt;/div&gt;
  )
}

export default App;