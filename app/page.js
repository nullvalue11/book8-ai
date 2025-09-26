'use client'

import { useEffect, useMemo, useState } from 'react'

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return new Date(iso).toLocaleString()
  }
}

const AuthCard = ({ onAuth }) => {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleAuth = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `${mode} failed`)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('book8_token', d.token)
        window.localStorage.setItem('book8_user', JSON.stringify(d.user))
      }
      onAuth(d.token, d.user)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="max-w-md mx-auto bg-card text-card-foreground rounded-lg border border-border shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-4 text-center">{mode === 'login' ? 'Sign In' : 'Sign Up'}</h2>
      {error && <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4"><p className="text-destructive text-sm">{error}</p></div>}
      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" required />
        </div>
        <div>
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2" required />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground py-2 hover:opacity-90 disabled:opacity-60">{loading ? `${mode === 'login' ? 'Signing In' : 'Signing Up'}...` : mode === 'login' ? 'Sign In' : 'Sign Up'}</button>
      </form>
      <div className="mt-4 text-center">
        <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-sm text-primary hover:underline">
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
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

const BookingForm = ({ token, onCreated }) => {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [customerName, setCustomerName] = useState('')

  const createBooking = async (e) => {
    e.preventDefault()
    if (!title || !start || !end) return
    setLoading(true)
    try {
      const r = await fetch('/api/bookings', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ title, startTime: start, endTime: end, notes, customerName }) })
      const raw = await r.text(); const d = raw ? JSON.parse(raw) : null
      if (!r.ok) throw new Error(d?.error || 'Failed')
      setTitle(''); setStart(''); setEnd(''); setNotes(''); setCustomerName(''); onCreated()
    } catch (e) { alert(e.message) } finally { setLoading(false) }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <h3 className="font-semibold mb-2">Create booking</h3>
      <form onSubmit={createBooking} className="space-y-3">
        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        <input type="text" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" required />
        <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={2} />
        <button type="submit" disabled={loading} className="w-full rounded-md bg-primary text-primary-foreground py-2 hover:opacity-90 disabled:opacity-60">{loading ? 'Creating...' : 'Create Booking'}</button>
      </form>
    </div>
  )
}

const BookingsTable = ({ token, items, refresh }) => {
  const cancelBooking = async (id) => {
    try {
      const r = await fetch(`/api/bookings/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const raw = await r.text(); const d = raw ? JSON.parse(raw) : null
      if (!r.ok) throw new Error(d?.error || 'Failed'); refresh()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <h3 className="font-semibold mb-4">Bookings</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No bookings yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div>
                <div className="font-medium">{item.title}</div>
                {item.customerName && <div className="text-sm text-muted-foreground">Customer: {item.customerName}</div>}
                <div className="text-sm text-muted-foreground">{formatDate(item.startTime)} – {formatDate(item.endTime)}</div>
                {item.notes && <div className="text-sm text-muted-foreground mt-1">{item.notes}</div>}
                {item.timeZone && <div className="text-xs text-muted-foreground">Timezone: {item.timeZone}</div>}
                <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${item.status === 'canceled' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {item.status || 'confirmed'}
                </div>
              </div>
              <div>
                {item.status !== 'canceled' && (
                  <button onClick={() => cancelBooking(item.id)} className="px-3 py-1 rounded-md bg-destructive text-destructive-foreground hover:opacity-90">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
      const body = searchType === 'booking' 
        ? JSON.stringify({ prompt: query, context: {} })
        : JSON.stringify({ query, maxResults: 5 })
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body
      })

      // Improved error handling as per fix plan
      const text = await response.text()
      let data
      try { 
        data = JSON.parse(text) 
      } catch { 
        data = { ok: false, error: 'Non-JSON response from server' }
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Adapt to new API response format
      if (searchType === 'booking') {
        // Booking assistant returns { ok: true, data: { summary, sources } }
        setResults({
          answer: data.data?.summary || null,
          results: data.data?.sources || [],
          total_results: data.data?.sources?.length || 0,
          timestamp: new Date().toISOString()
        })
      } else {
        // General search returns { ok: true, data: { answer, results, ... } }
        setResults({
          answer: data.data?.answer || null,
          results: data.data?.results || [],
          total_results: data.data?.results?.length || 0,
          timestamp: new Date().toISOString()
        })
      }
      
    } catch (err) {
      console.error('[TavilySearch] Error:', err)
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
                  {result.content && <p className="text-xs text-foreground">{result.content.substring(0, 150)}...</p>}
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
  const sub = user?.subscription
  const isActive = sub?.status === 'active'
  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border shadow-sm p-4">
      <h3 className="font-semibold mb-2">Billing</h3>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">Status: {sub?.status || 'No subscription'}</div>
        {sub?.currentPeriodEnd && <div className="text-sm text-muted-foreground">Period ends: {formatDate(sub.currentPeriodEnd)}</div>}
        {isActive ? (
          <button disabled={loading} onClick={async () => { setLoading(true); try { const r = await fetch('/api/billing/portal', { headers: { Authorization: `Bearer ${token}` } }); const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else alert('Portal unavailable') } catch { alert('Portal error') } finally { setLoading(false) } }} className="px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60">{loading ? 'Loading...' : 'Manage Billing'}</button>
        ) : (
          <div className="text-sm text-muted-foreground">Billing features coming soon</div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [token, setToken] = useState('')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [items, setItems] = useState([])
  const [banner, setBanner] = useState('')

  const setUserLocal = (u) => {
    setUser(u)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('book8_user', JSON.stringify(u))
    }
  }

  const logout = () => {
    setToken('')
    setUser(null)
    setProfile(null)
    setItems([])
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('book8_token')
      window.localStorage.removeItem('book8_user')
    }
  }

  const loadBookings = async () => {
    if (!token) return
    try {
      const r = await fetch('/api/bookings', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      const raw = await r.text(); const d = raw ? JSON.parse(raw) : []
      setItems(Array.isArray(d) ? d : d.bookings || [])
    } catch (e) { console.error('Load bookings error:', e) }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = window.localStorage.getItem('book8_token')
      const savedUser = window.localStorage.getItem('book8_user')
      if (savedToken) setToken(savedToken)
      if (savedUser) setUser(JSON.parse(savedUser))

      const params = new URLSearchParams(window.location.search)
      if (params.get('google_connected') === '1') setBanner('Google Calendar connected successfully!')
      if (params.get('google_error')) setBanner(`Google Calendar error: ${params.get('google_error')}`)
      if (params.get('portal_return') === 'true') setBanner('Billing portal session completed.')
    }
  }, [])

  useEffect(() => { if (token) { loadBookings(); (async () => { try { const r = await fetch('/api/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); const raw = await r.text(); const u = raw ? JSON.parse(raw) : null; if (r.ok && u) setProfile(u) } catch {} })() } }, [token])

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header user={user} onLogout={logout} banner={banner} />
        <main className="container mx-auto py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">Book8 AI</h1>
            <p className="text-muted-foreground mt-2">AI-powered scheduling and booking platform</p>
          </div>
          <AuthCard onAuth={(token, user) => { setToken(token); setUserLocal(user) }} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header user={user} onLogout={logout} banner={banner} />
      <main className="container mx-auto py-6">
        {user?.subscription ? (
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