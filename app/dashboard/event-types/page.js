"use client";
import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import { Textarea } from '../../../components/ui/textarea'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  Calendar,
  X,
  Loader2
} from 'lucide-react'

export default function EventTypesPage() {
  const [token, setToken] = useState(null)
  const [eventTypes, setEventTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userHandle, setUserHandle] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    durationMinutes: 30
  })
  const [error, setError] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('book8_token')
    if (t) setToken(t)
  }, [])

  const loadEventTypes = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      const res = await fetch('/api/event-types', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.ok) {
        setEventTypes(data.eventTypes || [])
      }
    } catch (err) {
      console.error('Failed to load event types:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadUserHandle = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/settings/scheduling', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.scheduling?.handle) {
        setUserHandle(data.scheduling.handle)
      }
    } catch (err) {
      console.error('Failed to load user handle:', err)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      loadEventTypes()
      loadUserHandle()
    }
  }, [token, loadEventTypes, loadUserHandle])

  function openCreateModal() {
    setEditingType(null)
    setForm({ name: '', description: '', durationMinutes: 30 })
    setError('')
    setShowModal(true)
  }

  function openEditModal(eventType) {
    setEditingType(eventType)
    setForm({
      name: eventType.name,
      description: eventType.description || '',
      durationMinutes: eventType.durationMinutes
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    
    try {
      setSaving(true)
      setError('')
      
      const url = editingType 
        ? `/api/event-types/${editingType.id}`
        : '/api/event-types'
      
      const res = await fetch(url, {
        method: editingType ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return
      }
      
      setShowModal(false)
      loadEventTypes()
      
    } catch (err) {
      setError('Failed to save event type')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(eventType) {
    try {
      await fetch(`/api/event-types/${eventType.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !eventType.isActive })
      })
      loadEventTypes()
    } catch (err) {
      console.error('Failed to toggle event type:', err)
    }
  }

  async function handleDelete(eventType) {
    if (!confirm(`Delete "${eventType.name}"? This cannot be undone.`)) {
      return
    }
    
    try {
      await fetch(`/api/event-types/${eventType.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      loadEventTypes()
    } catch (err) {
      console.error('Failed to delete event type:', err)
    }
  }

  function copyLink(eventType) {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://book8-ai.vercel.app'
    const link = `${baseUrl}/b/${userHandle}/${eventType.slug}`
    navigator.clipboard.writeText(link)
    setCopiedId(eventType.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function getPublicLink(eventType) {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'https://book8-ai.vercel.app'
    return `${baseUrl}/b/${userHandle}/${eventType.slug}`
  }

  if (!token) {
    return (
      <main className="min-h-screen p-8 bg-background">
        <div className="max-w-4xl mx-auto text-center py-12">
          <p className="text-muted-foreground">Please log in to manage event types.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Event Types</h1>
            <p className="text-muted-foreground">
              Create different booking types with custom durations and settings
            </p>
          </div>
          <Button onClick={openCreateModal} className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Event Type
          </Button>
        </div>

        {!userHandle && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="py-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Set up your booking handle in{' '}
                <a href="/dashboard/settings/scheduling" className="underline font-medium">
                  Settings → Scheduling
                </a>{' '}
                to share public booking links.
              </p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : eventTypes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No event types yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first event type to offer different booking options.
              </p>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create Event Type
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {eventTypes.map(eventType => (
              <Card key={eventType.id} className={!eventType.isActive ? 'opacity-60' : ''}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg">{eventType.name}</h3>
                        {!eventType.isActive && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      {eventType.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {eventType.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {eventType.durationMinutes} min
                        </span>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          /{eventType.slug}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={eventType.isActive}
                        onCheckedChange={() => handleToggleActive(eventType)}
                      />
                      
                      {userHandle && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyLink(eventType)}
                            disabled={!eventType.isActive}
                          >
                            {copiedId === eventType.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            disabled={!eventType.isActive}
                          >
                            <a 
                              href={getPublicLink(eventType)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(eventType)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(eventType)}
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <h4 className="font-medium mb-2">💡 Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Each event type gets a unique booking link you can share</li>
              <li>• Inactive event types won't accept new bookings</li>
              <li>• Your default link <code className="bg-background px-1 rounded">/b/{userHandle || 'your-handle'}</code> still works for your default duration</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingType ? 'Edit Event Type' : 'New Event Type'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., 30-min Consultation"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this event type..."
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  max="480"
                  value={form.durationMinutes}
                  onChange={e => setForm(prev => ({ 
                    ...prev, 
                    durationMinutes: parseInt(e.target.value) || 30 
                  }))}
                />
              </div>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    editingType ? 'Save Changes' : 'Create Event Type'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}
