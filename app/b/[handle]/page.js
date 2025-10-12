"use client";
import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function PublicBookingPage({ params }) {
  const handle = params.handle
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', notes:'' })
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => { load() }, [date, tz])

  async function load() {
    try {
      setLoading(true)
      const res = await fetch(`/api/availability?handle=${encodeURIComponent(handle)}&date=${date}&tz=${encodeURIComponent(tz)}`)
      const data = await res.json()
      setSlots((data?.slots || []))
    } catch { setSlots([]) } finally { setLoading(false) }
  }

  async function book() {
    try {
      setMessage('')
      if (!selected) { setMessage('Please select a time'); return }
      const body = { handle, slotStart: selected.start, slotEnd: selected.end, guest: form }
      const res = await fetch('/api/public/bookings', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Booking failed')
      setMessage('You\'re booked! Check your email for details.')
    } catch (e) { setMessage(e.message) }
  }

  return (
    <main className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader><CardTitle>Book time with {handle}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-1">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Time zone</Label>
              <Input value={tz} onChange={e=>setTz(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="block mb-2">Available times</Label>
            {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
              <div className="flex flex-wrap gap-2">
                {slots.length === 0 && <p className="text-sm text-muted-foreground">No available times on this date.</p>}
                {slots.map(s => (
                  <button key={s.start} onClick={()=>setSelected(s)} className={`px-3 py-2 rounded border text-sm ${selected?.start===s.start ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                    {new Date(s.start).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} /></div>

          <div className="flex items-center gap-2"><Button onClick={book} disabled={!selected}>Book</Button>{message && <span className="text-sm text-muted-foreground">{message}</span>}</div>
        </CardContent>
      </Card>
    </main>
  )
}
