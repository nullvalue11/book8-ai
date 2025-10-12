"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function SchedulingSettingsPage() {
  const [token, setToken] = useState(null)
  const [form, setForm] = useState({ handle: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', defaultDurationMin: 30, bufferMin: 0, minNoticeMin: 120 })
  const [wh, setWh] = useState({ mon:[{start:'09:00',end:'17:00'}], tue:[{start:'09:00',end:'17:00'}], wed:[{start:'09:00',end:'17:00'}], thu:[{start:'09:00',end:'17:00'}], fri:[{start:'09:00',end:'17:00'}], sat:[], sun:[] })
  const [calIds, setCalIds] = useState([])
  const [msg, setMsg] = useState('')

  useEffect(() => { const t = localStorage.getItem('book8_token'); if (t) setToken(t); }, [])
  useEffect(() => { if (token) load() }, [token])

  async function load() {
    try {
      const res = await fetch('/api/settings/scheduling', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data?.scheduling) {
        setForm({ ...form, ...data.scheduling })
        setWh(data.scheduling.workingHours || wh)
        setCalIds(data.scheduling.selectedCalendarIds || [])
      }
    } catch {}
  }

  async function save() {
    try {
      setMsg('')
      const res = await fetch('/api/settings/scheduling', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...form, workingHours: wh, selectedCalendarIds: calIds }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      setMsg('Saved')
    } catch (e) { setMsg(e.message) }
  }

  function updateWh(day, idx, key, val) {
    setWh(prev => ({ ...prev, [day]: prev[day].map((b,i) => i===idx ? { ...b, [key]: val } : b) }))
  }

  return (
    <main className="container mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader><CardTitle>Scheduling Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Public handle</Label><Input value={form.handle} onChange={e=>setForm({...form, handle:e.target.value})} placeholder="yourname" /></div>
            <div className="space-y-1"><Label>Time zone</Label><Input value={form.timeZone} onChange={e=>setForm({...form, timeZone:e.target.value})} /></div>
            <div className="space-y-1"><Label>Default duration (min)</Label><Input type="number" value={form.defaultDurationMin} onChange={e=>setForm({...form, defaultDurationMin:+e.target.value})} /></div>
            <div className="space-y-1"><Label>Buffer (min)</Label><Input type="number" value={form.bufferMin} onChange={e=>setForm({...form, bufferMin:+e.target.value})} /></div>
            <div className="space-y-1"><Label>Min notice (min)</Label><Input type="number" value={form.minNoticeMin} onChange={e=>setForm({...form, minNoticeMin:+e.target.value})} /></div>
          </div>

          <div>
            <Label className="block mb-2">Working hours</Label>
            {Object.entries(wh).map(([day, blocks]) => (
              <div key={day} className="flex items-center gap-3 mb-2 text-sm">
                <div className="w-12 capitalize">{day}</div>
                {blocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="w-24" value={b.start} onChange={e=>updateWh(day,i,'start',e.target.value)} />
                    <span>→</span>
                    <Input className="w-24" value={b.end} onChange={e=>updateWh(day,i,'end',e.target.value)} />
                  </div>
                ))}
                {blocks.length === 0 && <span className="text-muted-foreground">Closed</span>}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2"><Button onClick={save}>Save</Button>{msg && <span className="text-xs text-muted-foreground">{msg}</span>}</div>
          <div className="text-xs text-muted-foreground">Public link: {form.handle ? `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${form.handle}` : 'Set a handle to enable'}</div>
        </CardContent>
      </Card>
    </main>
  )
}
