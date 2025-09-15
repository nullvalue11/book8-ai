'use client'

import { useEffect, useMemo, useState } from 'react'

function useAuth() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('book8_token') : null
    const u = typeof window !== 'undefined' ? window.localStorage.getItem('book8_user') : null
    if (t) setToken(t)
    if (u) try { setUser(JSON.parse(u)) } catch {}
  }, [])

  const login = (t, u) => {
    setToken(t)
    setUser(u)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('book8_token', t)
      window.localStorage.setItem('book8_user', JSON.stringify(u))
    }
  }

  const setUserLocal = (u) => {
    setUser(u)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('book8_user', JSON.stringify(u))
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('book8_token')
      window.localStorage.removeItem('book8_user')
    }
  }

  return { token, user, login, logout, setUserLocal }
}

const Header = ({ user, onLogout, banner }) => {
  return (
    <div className="w-full border-b border-border bg-card">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img className="h-8 w-8 rounded" src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" alt="Book8" />
            <div className="font-semibold">Book8 AI</div>
          </div>
          <div className="text-sm text-muted-foreground">
            {user ? (
              <div className="flex items-center gap-3">
                <span>{user?.email}</span>
                <button onClick={onLogout} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Logout</button>
              </div>
            ) : (
              <span>MVP Demo</span>
            )}
          </div>
        </div>
        {banner ? (
          <div className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">{banner}</div>
        ) : null}
      </div>
    </div>
  )
}

const AuthCard = ({ onAuth }) => {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const title = mode === 'login' ? 'Sign in' : 'Create your account'

  const submit = async (e) => {
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
    <div className="max-w-md mx-auto bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">JWT auth with MongoDB</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div className="space-y-1">
            <label className="text-sm">Name</label>
            <input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:ring-2 ring-ring" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60">
          {loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>
      </form>
      <div className="text-center mt-3 text-sm">
        {mode === 'login' ? (
          <button onClick={() => setMode('register')} className="text-foreground/80 hover:underline">New here? Create an account</button>
        ) : (
          <button onClick={() => setMode('login')} className="text-foreground/80 hover:underline">Already have an account? Sign in</button>
        )}
      </div>
    </div>
  )
}

const BookingForm = ({ token, onCreated }) => {
  const [title, setTitle] = useState('Intro call')
  const [customerName, setCustomerName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
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
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <h3 className="font-semibold mb-2">Create booking</h3>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm">Title</label>
          <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Customer name</label>
          <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Start time</label>
          <input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">End time</label>
          <input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-sm">Notes</label>
          <textarea className="w-full rounded-md border border-border bg-background px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60">
            {loading ? 'Saving…' : 'Save booking'}
          </button>
        </div>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

const BookingsTable = ({ token, items, refresh }) => {
  const cancelBooking = async (id) => {
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    await res.json()
    refresh()
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold">Your bookings</h3>
        <button onClick={refresh} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Start</th>
              <th className="text-left p-3">End</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>No bookings yet</td>
              </tr>
            ) : (
              (items || []).map((b) => (
                <tr key={b?.id}>
                  <td className="p-3">{b?.title}</td>
                  <td className="p-3">{b?.customerName || '—'}</td>
                  <td className="p-3">{new Date(b?.startTime).toLocaleString()}</td>
                  <td className="p-3">{new Date(b?.endTime).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b?.status === 'canceled' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {b?.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {b?.status !== 'canceled' ? (
                      <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90" onClick={() => cancelBooking(b?.id)}>Cancel</button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const IntegrationsCard = ({ token, profile, onProfile }) => {
  const [loading, setLoading] = useState(false)
  const connected = !!profile?.google?.connected
  const last = profile?.google?.lastSyncedAt

  const connect = async () => {
    try {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem('book8_token') : ''
      // Pass JWT via query param so API can verify without Authorization header
      if (token) {
        window.location.href = `/api/integrations/google/auth?jwt=${encodeURIComponent(token)}`
      } else {
        window.location.href = '/api/integrations/google/auth'
      }
    } catch {
      window.location.href = '/api/integrations/google/auth'
    }
  }

  const syncNow = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/integrations/google/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Sync failed')
      const ru = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
      const ud = await ru.json()
      if (ru.ok) onProfile(ud)
      alert(`Synced: created ${d?.created || 0}, updated ${d?.updated || 0}`)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Integrations</h3>
        <button onClick={async () => {
          const r = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
          const u = await r.json(); if (r.ok) onProfile(u)
        }} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Refresh</button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Google Calendar</div>
            <div className="text-sm text-muted-foreground">{connected ? 'Connected' : 'Not connected'}{last ? ` • Last synced ${new Date(last).toLocaleString()}` : ''}</div>
          </div>
          <div className="flex gap-2">
            {!connected ? (
              <button className="rounded-md border border-border px-3 py-2 hover:bg-muted" onClick={connect}>Connect</button>
            ) : (
              <button disabled={loading} className="rounded-md bg-primary text-primary-foreground px-3 py-2 disabled:opacity-60" onClick={syncNow}>{loading ? 'Syncing…' : 'Sync now'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const BillingCard = ({ token, user, onUserUpdate }) => {
  const [loading, setLoading] = useState(false)

  const subscribe = async (plan) => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      if (data?.url) window.location.href = data.url
    } catch (e) {
      alert(e.message || 'Error creating checkout session')
    } finally {
      setLoading(false)
    }
  }

  const manage = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/portal', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      if (data?.url) window.location.href = data.url
    } catch (e) {
      alert(e.message || 'Error opening portal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Billing</h3>
        <button onClick={async () => {
          const r = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
          const u = await r.json()
          if (r.ok) onUserUpdate(u)
        }} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Refresh</button>
      </div>
      {user?.subscription ? (
        <div className="space-y-2">
          <div className="text-sm">Status: <span className="font-medium capitalize">{user.subscription.status}</span></div>
          <div className="text-sm">Plan price: <span className="font-mono">{user.subscription.priceId || 'N/A'}</span></div>
          <div className="text-sm">Renewal: {user.subscription.currentPeriodEnd ? new Date(user.subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}</div>
          <button disabled={loading} onClick={manage} className="mt-2 w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60">Manage Subscription</button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">No active subscription</div>
          <div className="grid grid-cols-3 gap-2">
            <button disabled={loading} onClick={() => subscribe('starter')} className="rounded-md border border-border px-3 py-2 hover:bg-muted">Starter</button>
            <button disabled={loading} onClick={() => subscribe('growth')} className="rounded-md border border-border px-3 py-2 hover:bg-muted">Growth</button>
            <button disabled={loading} onClick={() => subscribe('enterprise')} className="rounded-md border border-border px-3 py-2 hover:bg-muted">Enterprise</button>
          </div>
        </div>
      )}
    </div>
  )
}

const Dashboard = ({ token, user, onLogout, setUserLocal, banner }) => {
  const [items, setItems] = useState([])
  const [profile, setProfile] = useState(user)
  const loadBookings = async () => {
    if (!token) return
    const res = await fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) setItems(Array.isArray(data) ? data : [])
  }
  const loadUser = async () => {
    if (!token) return
    const res = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (res.ok) { setProfile(data); setUserLocal(data) }
  }
  useEffect(() => { loadBookings(); loadUser() }, [token])

  return (
    <div>
      <Header user={profile} onLogout={onLogout} banner={banner} />
      <main className="container py-6 grid gap-6 md:grid-cols-5">
        <div className="md:col-span-2 space-y-6">
          <BookingForm token={token} onCreated={() => loadBookings()} />
          <IntegrationsCard token={token} profile={profile} onProfile={(u) => { setProfile(u); setUserLocal(u) }} />
          <div className="grid gap-3">
            <button className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted" onClick={async () => {
              const r = await fetch('/api/integrations/voice/call', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
              const d = await r.json(); alert(d?.message || 'Voice (stub)')
            }}>Test Voice Call (stub)</button>
            <button className="w-full rounded-md border border-border px-4 py-2 text-left hover:bg-muted" onClick={async () => {
              const r = await fetch('/api/integrations/search', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ q: 'business hours' }) })
              const d = await r.json(); alert(d?.note || 'Search (stub)')
            }}>Web Search (stub)</button>
          </div>
          <BillingCard token={token} user={profile} onUserUpdate={(u) => { setProfile(u); setUserLocal(u) }} />
        </div>
        <div className="md:col-span-3">
          <BookingsTable token={token} items={items} refresh={loadBookings} />
        </div>
      </main>
    </div>
  )
}

const Home = () => {
  const { token, user, login, logout, setUserLocal } = useAuth()
  const [banner, setBanner] = useState('')
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === 'true') setBanner('Subscription updated successfully.')
      else if (params.get('portal_return') === 'true') setBanner('Returned from Billing Portal.')
      else if (params.get('canceled') === 'true') setBanner('Checkout canceled.')
      else if (params.get('google_connected') === '1') setBanner('Google Calendar connected.')
      else if (params.get('google_error')) setBanner('Google integration error: ' + params.get('google_error'))
    } catch {}
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {token ? (
        <Dashboard token={token} user={user} onLogout={logout} setUserLocal={setUserLocal} banner={banner} />
      ) : (
        <div>
          <Header banner={banner} />
          <main className="container py-10">
            <div className="max-w-2xl mx-auto text-center mb-8">
              <h1 className="text-3xl font-bold">Book8 AI</h1>
              <p className="text-muted-foreground mt-2">Scheduling, voice, and web search — wired with a modular workflow engine. Start by creating your account.</p>
            </div>
            <AuthCard onAuth={login} />
          </main>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <Home />
    </div>
  )
}

export default App;