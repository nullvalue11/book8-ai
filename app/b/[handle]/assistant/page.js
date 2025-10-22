"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Send, Calendar, Clock } from 'lucide-react'

function useGuestTz() {
  return useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  }, [])
}

function Bubble({ role, children }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {children}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  const params = useParams()
  const handle = params?.handle
  const guestTz = useGuestTz()

  const [messages, setMessages] = useState([
    { id: 'sys-hello', role: 'assistant', content: `Hi! I can help you find time with ${handle}. Tell me when you'd like to meet (e.g., "30m tomorrow afternoon" or "next Wed 3pm").` }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [slots, setSlots] = useState([]) // from API, includes dual-tz labels
  const [bookOpen, setBookOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', title: 'Meeting' })
  const listRef = useRef(null)

  useEffect(() => {
    try { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }) } catch {}
  }, [messages, slots])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages(prev => [...prev, { id: String(Date.now()), role: 'user', content: text }])
    setThinking(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-timezone': guestTz
        },
        body: JSON.stringify({ handle, message: text })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')

      if (data.reply) {
        setMessages(prev => [...prev, { id: 'a-' + Date.now(), role: 'assistant', content: data.reply }])
      }
      setSlots(data.slots || [])
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'assistant', content: 'Sorry, I could not process that. Please try again.' }])
    } finally {
      setThinking(false)
    }
  }

  async function book(slot) {
    setSelected(slot)
    setBookOpen(true)
  }

  async function confirmBooking() {
    if (!selected) return
    if (!form.name || !form.email) return
    try {
      setThinking(true)
      const res = await fetch(`/api/public/${encodeURIComponent(handle)}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          title: form.title || 'Meeting',
          notes: `Booked via assistant on ${new Date().toISOString()}`,
          start: selected.start,
          end: selected.end,
          guestTimezone: guestTz
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to book')
      setMessages(prev => [...prev, { id: 'book-' + Date.now(), role: 'assistant', content: `Booked ${selected?.guestLabel}. A confirmation was sent to ${form.email}.` }])
      setSlots([])
      setBookOpen(false)
      setSelected(null)
      setForm({ name: '', email: '', title: 'Meeting' })
    } catch (e) {
      setMessages(prev => [...prev, { id: 'book-err-' + Date.now(), role: 'assistant', content: e.message || 'Booking failed' }])
    } finally {
      setThinking(false)
    }
  }

  const quick = [
    '30m tomorrow afternoon',
    'next Wed 3pm',
    'any time today',
    'this evening'
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-2xl font-semibold">Booking Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">Chat to find times. Your timezone: <span className="font-medium">{guestTz}</span></p>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl p-6 grid grid-rows-[auto,1fr,auto] gap-4 min-h-[80vh]">
        {/* Messages */}
        <Card className="row-start-1 row-end-1">
          <CardContent className="pt-4">
            <div ref={listRef} className="flex flex-col gap-3 max-h-[45vh] overflow-auto">
              {messages.map(m => (
                <Bubble key={m.id} role={m.role}>{m.content}</Bubble>
              ))}
              {thinking && <Bubble role="assistant"><span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</span></Bubble>}
            </div>
          </CardContent>
        </Card>

        {/* Slots */}
        {slots.length > 0 && (
          <Card className="row-start-2 row-end-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Calendar className="w-5 h-5" /> Suggested Times</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {slots.map(slot => (
                  <button key={slot.start}
                    onClick={() => book(slot)}
                    className="text-left p-3 rounded-lg border hover:border-primary bg-card"
                  >
                    <div className="text-sm font-medium">{slot.guestLabel}</div>
                    <div className="text-xs text-muted-foreground">Host: {slot.hostLabel}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Input */}
        <div className="row-start-3 row-end-3">
          <div className="flex flex-wrap gap-2 mb-2">
            {quick.map(q => (
              <Button key={q} size="sm" variant="outline" onClick={() => setInput(q)}>{q}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Describe a time (e.g., next Wed 3pm)" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} />
            <Button onClick={sendMessage} disabled={!input || thinking}><Send className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Booking Modal (simple inline) */}
        {bookOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
            <div className="bg-card rounded-lg w-full max-w-md border">
              <div className="p-4 border-b">
                <div className="text-lg font-semibold flex items-center gap-2"><Clock className="w-4 h-4" /> Confirm booking</div>
                <div className="text-xs text-muted-foreground mt-1">{selected?.guestLabel} (Host: {selected?.hostLabel})</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => { setBookOpen(false); setSelected(null) }}>Cancel</Button>
                  <Button onClick={confirmBooking} disabled={!form.name || !form.email || thinking}>{thinking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Booking…</> : 'Book'}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
