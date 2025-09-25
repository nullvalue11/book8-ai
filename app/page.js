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

const Header = ({ user, onLogout, banner }) => {
  console.log('[Header] User data:', user) // Debug logging
  return (
    <div className="w-full border-b border-border bg-card">
      <div className="container py-4">
        {banner && <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded mb-4">{banner}</div>}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Book8 AI</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="text-sm text-muted-foreground">
                  Logged in as <span className="font-medium">{user?.email}</span>
                </div>
                <button 
                  onClick={onLogout} 
                  className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">MVP Demo</span>
            )}
          </div>
        </div>
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

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email, password, name }) })
      const raw = await res.text()
      const data = raw ? JSON.parse(raw) : null
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
      onAuth(data.token, data.user)
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-md mx-auto bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
        <p className="text-sm text-muted-foreground">JWT auth with MongoDB</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div className="space-y-1"><label className="text-sm">Name</label><input className="w-full rounded-md border border-border bg-background px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Jane Doe" /></div>
        )}
        <div className="space-y-1"><label className="text-sm">Email</label><input type="email" className="w-full rounded-md border border-border bg-background px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" required /></div>
        <div className="space-y-1"><label className="text-sm">Password</label><input type="password" className="w-full rounded-md border border-border bg-background px-3 py-2" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" required /></div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60">{loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}</button>
      </form>
      <div className="text-center mt-3 text-sm">
        {mode === 'login' ? (
          <button onClick={()=>setMode('register')} className="text-foreground/80 hover:underline">New here? Create an account</button>
        ) : (
          <button onClick={()=>setMode('login')} className="text-foreground/80 hover:underline">Already have an account? Sign in</button>
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
  const tz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`, 'X-Client-Timezone': tz }, body: JSON.stringify({ title, customerName, startTime, endTime, notes, timeZone: tz }) })
      const raw = await res.text()
      const data = raw ? JSON.parse(raw) : null
      if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
      onCreated(data)
      setCustomerName(''); setNotes('')
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <h3 className="font-semibold mb-2">Create booking</h3>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1"><label className="text-sm">Title</label><input className="w-full rounded-md border border-border bg-background px-3 py-2" value={title} onChange={(e)=>setTitle(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-sm">Customer name</label><input className="w-full rounded-md border border-border bg-background px-3 py-2" value={customerName} onChange={(e)=>setCustomerName(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-sm">Start time</label><input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={startTime} onChange={(e)=>setStartTime(e.target.value)} required /></div>
        <div className="space-y-1"><label className="text-sm">End time</label><input type="datetime-local" className="w-full rounded-md border border-border bg-background px-3 py-2" value={endTime} onChange={(e)=>setEndTime(e.target.value)} required /></div>
        <div className="md:col-span-2 text-xs text-muted-foreground">Time zone: {tz}</div>
        <div className="md:col-span-2"><button disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-60">{loading ? 'Saving…' : 'Save booking'}</button></div>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

const BookingsTable = ({ token, items, refresh }) => {
  const cancelBooking = async (id) => {
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    await res.text()
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
              <tr><td className="p-3 text-muted-foreground" colSpan={8}>No bookings yet</td></tr>
            ) : (
              (items || []).map((b) => (
                <tr key={b?.id}>
                  <td className="p-3"><div className="flex items-center gap-2"><span>{b?.title}</span>{b?.conflict ? <span className="text-xs px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">conflict</span> : null}</div></td>
                  <td className="p-3">{b?.customerName || '—'}</td>
                  <td className="p-3">{formatInTz(b?.startTime, b?.timeZone)}</td>
                  <td className="p-3">{formatInTz(b?.endTime, b?.timeZone)}</td>
                  <td className="p-3"><span className="text-xs rounded bg-muted px-2 py-0.5">{b?.timeZone || '—'}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${b?.source === 'google' ? 'bg-secondary text-secondary-foreground' : 'bg-muted'}`}>{b?.source === 'google' ? 'Google' : 'Book8'}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${b?.status === 'canceled' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>{b?.status}</span></td>
                  <td className="p-3">{b?.source === 'google' ? (b?.htmlLink ? <a className="underline" href={b.htmlLink} target="_blank" rel="noreferrer">Open</a> : <span className="text-muted-foreground">—</span>) : (b?.status !== 'canceled' ? (<button className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90" onClick={() => cancelBooking(b?.id)}>Cancel</button>) : (<span className="text-muted-foreground">—</span>))}</td>
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
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [showCalendars, setShowCalendars] = useState(false)
  const [availableCalendars, setAvailableCalendars] = useState([])
  const connected = !!profile?.google?.connected || !!profile?.google?.refreshToken
  const last = profile?.google?.lastSyncedAt

  console.log('[IntegrationsCard] Profile data:', profile) // Debug logging
  console.log('[IntegrationsCard] Connected status:', connected) // Debug logging
  console.log('[IntegrationsCard] Google data:', profile?.google) // Debug logging

  const connect = async () => {
    try {
      console.log('[Google Connect] Starting connection process')
      const t = typeof window !== 'undefined' ? window.localStorage.getItem('book8_token') : ''
      console.log('[Google Connect] JWT token present:', !!t)
      
      if (t) {
        const url = `/api/integrations/google/auth?jwt=${encodeURIComponent(t)}`
        console.log('[Google Connect] Redirecting to:', url)
        window.location.href = url
      } else {
        console.log('[Google Connect] No JWT token, redirecting without token')
        window.location.href = '/api/integrations/google/auth'
      }
    } catch (err) { 
      console.error('[Google Connect] Error:', err)
      window.location.href = '/api/integrations/google/auth' 
    }
  }

  const syncNow = async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/integrations/google/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const raw = await r.text()
      const d = raw ? JSON.parse(raw) : null
      if (!r.ok) throw new Error(d?.error || 'Sync failed')
      const ru = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const rud = await ru.text(); const ud = rud ? JSON.parse(rud) : null
      if (ru.ok && ud) onProfile(ud)
      alert(`Synced: created ${d?.created || 0}, updated ${d?.updated || 0}${d?.deleted !== undefined ? ", deleted " + d.deleted : ''}${d?.calendarsSelected ? " across " + d.calendarsSelected + " calendars" : ''}`)
    } catch (e) { alert(e.message) } finally { setLoading(false) }
  }

  const loadCalendars = async () => {
    try {
      setCalendarsLoading(true)
      const r = await fetch('/api/integrations/google/calendars', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const raw = await r.text()
      const d = raw ? JSON.parse(raw) : null
      if (!r.ok) throw new Error(d?.error || 'Failed to load calendars')
      setAvailableCalendars(d?.calendars || [])
      setShowCalendars(true)
    } catch (e) { 
      alert(e.message) 
      setShowCalendars(false)
    } finally { 
      setCalendarsLoading(false) 
    }
  }

  const saveCalendarSelection = async () => {
    try {
      setCalendarsLoading(true)
      const selectedIds = availableCalendars.filter(cal => cal.selected).map(cal => cal.id)
      if (selectedIds.length === 0) {
        alert('Please select at least one calendar')
        return
      }
      
      const r = await fetch('/api/integrations/google/calendars', { 
        method: 'POST', 
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json',
          Accept: 'application/json' 
        },
        body: JSON.stringify({ selectedCalendars: selectedIds })
      })
      const raw = await r.text()
      const d = raw ? JSON.parse(raw) : null
      if (!r.ok) throw new Error(d?.error || 'Failed to save calendar selection')
      
      alert(`Calendar selection saved! Selected ${selectedIds.length} calendar(s).`)
      setShowCalendars(false)
      
      // Refresh user profile
      const ru = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const rud = await ru.text(); const ud = rud ? JSON.parse(rud) : null
      if (ru.ok && ud) onProfile(ud)
    } catch (e) { 
      alert(e.message) 
    } finally { 
      setCalendarsLoading(false) 
    }
  }

  const toggleCalendar = (calendarId) => {
    setAvailableCalendars(prev => 
      prev.map(cal => 
        cal.id === calendarId 
          ? { ...cal, selected: !cal.selected }
          : cal
      )
    )
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Integrations</h3>
        <button onClick={async () => { const r = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); const raw = await r.text(); const u = raw ? JSON.parse(raw) : null; if (r.ok && u) onProfile(u) }} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Refresh</button>
      </div>
      
      <div className="space-y-4">
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
          
          {connected && (
            <div className="flex gap-2">
              <button 
                disabled={calendarsLoading} 
                className="text-sm rounded-md border border-border px-3 py-1 hover:bg-muted disabled:opacity-60" 
                onClick={showCalendars ? () => setShowCalendars(false) : loadCalendars}
              >
                {calendarsLoading ? 'Loading...' : (showCalendars ? 'Hide Calendars' : 'Choose Calendars')}
              </button>
            </div>
          )}
        </div>

        {showCalendars && (
          <div className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Select Calendars to Sync</h4>
              <button 
                disabled={calendarsLoading}
                className="text-sm rounded-md bg-primary text-primary-foreground px-3 py-1 disabled:opacity-60 hover:opacity-90"
                onClick={saveCalendarSelection}
              >
                {calendarsLoading ? 'Saving...' : 'Save Selection'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableCalendars.map(calendar => (
                <div key={calendar.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`cal-${calendar.id}`}
                    checked={calendar.selected}
                    onChange={() => toggleCalendar(calendar.id)}
                    className="rounded"
                  />
                  <label htmlFor={`cal-${calendar.id}`} className="flex-1 text-sm cursor-pointer">
                    <span className="font-medium">{calendar.summary}</span>
                    {calendar.primary && <span className="ml-2 text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Primary</span>}
                    {calendar.description && <div className="text-muted-foreground text-xs">{calendar.description}</div>}
                  </label>
                </div>
              ))}
            </div>
            
            {availableCalendars.length === 0 && !calendarsLoading && (
              <div className="text-sm text-muted-foreground text-center py-2">No calendars found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const TavilySearch = ({ token }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchType, setSearchType] = useState('general') // 'general' or 'booking'

  const performSearch = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    setError('')
    setResults(null)
    
    try {
      const endpoint = searchType === 'booking' ? '/api/search/booking-assistant' : '/api/search'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ query, maxResults: 5, includeAnswer: true })
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setResults(data)
      
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      performSearch()
    }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">AI Web Search</h3>
        <div className="flex gap-2 text-xs">
          <button 
            onClick={() => setSearchType('general')}
            className={`px-2 py-1 rounded ${searchType === 'general' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            General
          </button>
          <button 
            onClick={() => setSearchType('booking')}
            className={`px-2 py-1 rounded ${searchType === 'booking' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}
          >
            Booking Assistant
          </button>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={searchType === 'booking' ? "Search for venues, restaurants, services..." : "Search for real-time information..."}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled={loading}
          />
          <button 
            onClick={performSearch}
            disabled={!query.trim() || loading}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
        
        {results && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.answer && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">AI Answer</h4>
                <p className="text-blue-800 dark:text-blue-200 text-sm">{results.answer}</p>
              </div>
            )}
            
            {results.bookingInfo?.hasBookingInfo && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3">
                <h4 className="font-semibold text-sm mb-2 text-green-900 dark:text-green-100">Booking Information Found</h4>
                {results.bookingInfo.venues?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-green-800 dark:text-green-200">Venues: </span>
                    <span className="text-xs text-green-700 dark:text-green-300">{results.bookingInfo.venues.join(', ')}</span>
                  </div>
                )}
                {results.bookingInfo.phones?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-green-800 dark:text-green-200">Phone: </span>
                    <span className="text-xs text-green-700 dark:text-green-300">{results.bookingInfo.phones.join(', ')}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Results ({results.total_results})</h4>
              {results.results?.slice(0, 3).map((result, index) => (
                <div key={index} className="border border-border rounded-md p-2">
                  <h5 className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      {result.title}
                    </a>
                  </h5>
                  <p className="text-xs text-muted-foreground mb-1">{result.url}</p>
                  <p className="text-xs text-foreground">{result.content.substring(0, 150)}...</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const BillingCard = ({ token, user, onUserUpdate }) => {
  const [loading, setLoading] = useState(false)

  const subscribe = async (plan) => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) })
      const raw = await res.text(); const data = raw ? JSON.parse(raw) : null
      if (!res.ok) throw new Error(data?.error || 'Failed')
      if (data?.url) window.location.href = data.url
    } catch (e) { alert(e.message || 'Error creating checkout session') } finally { setLoading(false) }
  }

  const manage = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/billing/portal', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const raw = await res.text(); const data = raw ? JSON.parse(raw) : null
      if (!res.ok) throw new Error(data?.error || 'Failed')
      if (data?.url) window.location.href = data.url
    } catch (e) { alert(e.message || 'Error opening portal') } finally { setLoading(false) }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Billing</h3>
        <button onClick={async () => { const r = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); const raw = await r.text(); const u = raw ? JSON.parse(raw) : null; if (r.ok && u) onUserUpdate(u) }} className="px-3 py-1 rounded-md bg-secondary text-secondary-foreground hover:opacity-90">Refresh</button>
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

export default function Home() {
  const { token, user, login, logout, setUserLocal } = useAuth()
  const [items, setItems] = useState([])
  const [profile, setProfile] = useState(user)
  const [banner, setBanner] = useState('')

  const loadBookings = async () => {
    if (!token) return
    const res = await fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    const raw = await res.text(); const data = raw ? JSON.parse(raw) : []
    if (res.ok) setItems(Array.isArray(data) ? data : [])
  }
  const loadUser = async () => {
    if (!token) return
    const res = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    const raw = await res.text(); const data = raw ? JSON.parse(raw) : null
    if (res.ok && data) { setProfile(data); setUserLocal(data) }
  }

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

  useEffect(() => { loadBookings(); loadUser() }, [token])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header user={profile} onLogout={logout} banner={banner} />
      <main className="container py-10">
        {!token ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold">Book8 AI</h1>
              <p className="text-muted-foreground mt-2">Scheduling, billing, and Google Calendar sync. Create an account to get started.</p>
            </div>
            <AuthCard onAuth={login} />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-2 space-y-6">
              <BookingForm token={token} onCreated={() => loadBookings()} />
              <TavilySearch token={token} />
              <IntegrationsCard token={token} profile={profile} onProfile={(u) => { setProfile(u); setUserLocal(u) }} />
              <BillingCard token={token} user={profile} onUserUpdate={(u) => { setProfile(u); setUserLocal(u) }} />
            </div>
            <div className="md:col-span-3">
              <BookingsTable token={token} items={items} refresh={loadBookings} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}