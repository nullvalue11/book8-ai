'use client'

import { useEffect, useMemo, useState } from 'react'

function formatInTz(iso, tz) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

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

const BookingForm = ({ token, onCreated }) => {
  const [title, setTitle] = useState('Intro call')
  const [customerName, setCustomerName] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Client-Timezone': tz },
        body: JSON.stringify({ title, customerName, startTime, endTime, notes, timeZone: tz })
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
        <div className="md:col-span-2 text-xs text-muted-foreground">Time zone: {tz}</div>
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
              <th className="text-left p-3">TZ</th>
              <th className="text-left p-3">Source</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={8}>No bookings yet</td>
              </tr>
            ) : (
              (items || []).map((b) => (
                <tr key={b?.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{b?.title}</span>
                      {b?.conflict ? <span className="text-xs px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">conflict</span> : null}
                    </div>
                  </td>
                  <td className="p-3">{b?.customerName || '—'}</td>
                  <td className="p-3">{formatInTz(b?.startTime, b?.timeZone)}</td>
                  <td className="p-3">{formatInTz(b?.endTime, b?.timeZone)}</td>
                  <td className="p-3"><span className="text-xs rounded bg-muted px-2 py-0.5">{b?.timeZone || '—'}</span></td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b?.source === 'google' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>
                      {b?.source === 'google' ? 'Google' : 'Book8'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${b?.status === 'canceled' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      {b?.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {b?.source === 'google' ? (
                      b?.htmlLink ? <a className="underline" href={b.htmlLink} target="_blank" rel="noreferrer">Open</a> : <span className="text-muted-foreground">—</span>
                    ) : (
                      b?.status !== 'canceled' ? (
                        <button className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90" onClick={() => cancelBooking(b?.id)}>Cancel</button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
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

// Note: Header, IntegrationsCard, BillingCard remain unchanged

function App() {
  return (
    <div className="App">
      <Home />
    </div>
  )
}

export default App;