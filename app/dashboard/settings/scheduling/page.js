"use client";
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Copy, Check } from 'lucide-react'

export default function SchedulingSettingsPage() {
  const [token, setToken] = useState(null)
  const [form, setForm] = useState({ 
    handle: '', 
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', 
    defaultDurationMin: 30, 
    bufferMin: 0, 
    minNoticeMin: 120 
  })
  const [wh, setWh] = useState({ 
    mon: [{ start: '09:00', end: '17:00' }], 
    tue: [{ start: '09:00', end: '17:00' }], 
    wed: [{ start: '09:00', end: '17:00' }], 
    thu: [{ start: '09:00', end: '17:00' }], 
    fri: [{ start: '09:00', end: '17:00' }], 
    sat: [], 
    sun: [] 
  })
  const [is24x7, setIs24x7] = useState(false)
  const [calIds, setCalIds] = useState([])
  const [msg, setMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  const dayNames = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday'
  }

  useEffect(() => { 
    const t = localStorage.getItem('book8_token'); 
    if (t) setToken(t); 
  }, [])
  
  // load() is stable in component scope; adding it to deps can cause unnecessary re-renders/fetch loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { 
    if (token) load() 
  }, [token])

  async function load() {
    try {
      const res = await fetch('/api/settings/scheduling', { 
        headers: { Authorization: `Bearer ${token}` } 
      })
      const data = await res.json()
      if (data?.scheduling) {
        setForm({ ...form, ...data.scheduling })
        setWh(data.scheduling.workingHours || wh)
        setCalIds(data.scheduling.selectedCalendarIds || [])
        
        // Check if it's 24/7
        const all24 = Object.values(data.scheduling.workingHours || {}).every(
          blocks => blocks.length === 1 && blocks[0].start === '00:00' && blocks[0].end === '23:59'
        )
        setIs24x7(all24)
      }
    } catch {}
  }

  async function save() {
    try {
      setSaving(true)
      setMsg('')
      
      const payload = { 
        ...form, 
        workingHours: wh, 
        selectedCalendarIds: calIds 
      }
      
      const res = await fetch('/api/settings/scheduling', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        }, 
        body: JSON.stringify(payload) 
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to save')
      
      setMsg('✓ Settings saved successfully')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) { 
      setMsg('✗ ' + e.message) 
    } finally {
      setSaving(false)
    }
  }

  function toggle24x7() {
    if (!is24x7) {
      // Set all days to 24/7
      const all24 = {}
      Object.keys(wh).forEach(day => {
        all24[day] = [{ start: '00:00', end: '23:59' }]
      })
      setWh(all24)
      setIs24x7(true)
    } else {
      // Reset to default business hours
      setWh({
        mon: [{ start: '09:00', end: '17:00' }],
        tue: [{ start: '09:00', end: '17:00' }],
        wed: [{ start: '09:00', end: '17:00' }],
        thu: [{ start: '09:00', end: '17:00' }],
        fri: [{ start: '09:00', end: '17:00' }],
        sat: [],
        sun: []
      })
      setIs24x7(false)
    }
  }

  function updateWh(day, idx, key, val) {
    setWh(prev => ({ 
      ...prev, 
      [day]: prev[day].map((b, i) => i === idx ? { ...b, [key]: val } : b) 
    }))
    setIs24x7(false)
  }

  function addTimeBlock(day) {
    setWh(prev => ({ 
      ...prev, 
      [day]: [...prev[day], { start: '09:00', end: '17:00' }] 
    }))
    setIs24x7(false)
  }

  function removeTimeBlock(day, idx) {
    setWh(prev => ({ 
      ...prev, 
      [day]: prev[day].filter((_, i) => i !== idx) 
    }))
    setIs24x7(false)
  }

  function toggleDay(day, enabled) {
    if (enabled) {
      setWh(prev => ({ 
        ...prev, 
        [day]: [{ start: '09:00', end: '17:00' }] 
      }))
    } else {
      setWh(prev => ({ 
        ...prev, 
        [day]: [] 
      }))
    }
    setIs24x7(false)
  }

  function copyLink() {
    if (!form.handle) return
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${form.handle}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const presets = [
    { 
      name: '24/7', 
      apply: () => toggle24x7() 
    },
    { 
      name: 'Business Hours (9-5)', 
      apply: () => {
        setWh({
          mon: [{ start: '09:00', end: '17:00' }],
          tue: [{ start: '09:00', end: '17:00' }],
          wed: [{ start: '09:00', end: '17:00' }],
          thu: [{ start: '09:00', end: '17:00' }],
          fri: [{ start: '09:00', end: '17:00' }],
          sat: [],
          sun: []
        })
        setIs24x7(false)
      } 
    },
    { 
      name: 'Extended (8am-8pm)', 
      apply: () => {
        setWh({
          mon: [{ start: '08:00', end: '20:00' }],
          tue: [{ start: '08:00', end: '20:00' }],
          wed: [{ start: '08:00', end: '20:00' }],
          thu: [{ start: '08:00', end: '20:00' }],
          fri: [{ start: '08:00', end: '20:00' }],
          sat: [{ start: '10:00', end: '18:00' }],
          sun: []
        })
        setIs24x7(false)
      } 
    }
  ]

  return (
    <main className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Settings</CardTitle>
          <CardDescription>Configure your public booking page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="handle">Public Handle *</Label>
              <Input 
                id="handle"
                value={form.handle} 
                onChange={e => setForm({ ...form, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} 
                placeholder="yourname"
                className="book8-input"
              />
              <p className="text-xs text-muted-foreground">Only lowercase letters, numbers, and hyphens</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={form.timeZone}
                onChange={e => setForm({ ...form, timeZone: e.target.value })}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Default Duration (min)</Label>
              <Input 
                id="duration"
                type="number" 
                value={form.defaultDurationMin} 
                onChange={e => setForm({ ...form, defaultDurationMin: +e.target.value })}
                min="15"
                step="15"
                className="book8-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="buffer">Buffer Between (min)</Label>
              <Input 
                id="buffer"
                type="number" 
                value={form.bufferMin} 
                onChange={e => setForm({ ...form, bufferMin: +e.target.value })}
                min="0"
                step="5"
                className="book8-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notice">Min Notice (min)</Label>
              <Input 
                id="notice"
                type="number" 
                value={form.minNoticeMin} 
                onChange={e => setForm({ ...form, minNoticeMin: +e.target.value })}
                min="0"
                step="30"
                className="book8-input"
              />
            </div>
          </div>

          {form.handle && (
            <div className="pt-4 border-t">
              <Label className="block mb-2">Your Public Booking Link</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${form.handle}`}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={copyLink}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Availability Schedule</CardTitle>
              <CardDescription>Set when you're available for bookings</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="24x7" className="text-sm font-normal cursor-pointer">24/7 Availability</Label>
              <Switch 
                id="24x7"
                checked={is24x7} 
                onCheckedChange={toggle24x7} 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            <Label className="text-sm text-muted-foreground w-full">Quick Presets:</Label>
            {presets.map(preset => (
              <Button 
                key={preset.name}
                size="sm" 
                variant="outline" 
                onClick={preset.apply}
                className="text-xs"
              >
                {preset.name}
              </Button>
            ))}
          </div>

          {/* Days */}
          <div className="space-y-3">
            {Object.entries(wh).map(([day, blocks]) => (
              <div key={day} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={blocks.length > 0} 
                      onCheckedChange={enabled => toggleDay(day, enabled)}
                      disabled={is24x7}
                    />
                    <Label className="font-medium">{dayNames[day]}</Label>
                  </div>
                  {blocks.length > 0 && !is24x7 && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => addTimeBlock(day)}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add time
                    </Button>
                  )}
                </div>

                {blocks.length === 0 ? (
                  <p className="text-sm text-muted-foreground ml-10">Unavailable</p>
                ) : (
                  <div className="space-y-2 ml-10">
                    {blocks.map((block, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input 
                          type="time"
                          value={block.start} 
                          onChange={e => updateWh(day, idx, 'start', e.target.value)}
                          disabled={is24x7}
                          className="w-32"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input 
                          type="time"
                          value={block.end} 
                          onChange={e => updateWh(day, idx, 'end', e.target.value)}
                          disabled={is24x7}
                          className="w-32"
                        />
                        {!is24x7 && blocks.length > 1 && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removeTimeBlock(day, idx)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={save} 
          disabled={saving || !form.handle}
          className="gradient-primary text-white btn-glow"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        {msg && (
          <span className={`text-sm ${msg.includes('✓') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {msg}
          </span>
        )}
      </div>
    </main>
  )
}
