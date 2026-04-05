'use client'

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ArrowLeft, Camera, ChevronUp, ChevronDown, Loader2, Trash2, Upload } from 'lucide-react'
import Header from '@/components/Header'
import { getBookingTranslations, trFormat } from '@/lib/translations'
import { readInitialBookingLanguage } from '@/hooks/useBookingLanguage'
import { PORTFOLIO_PRESET_CATEGORY_KEYS, PORTFOLIO_MAX_FILE_BYTES } from '@/lib/portfolio'
import { normalizePlanKey } from '@/lib/plan-features'

const CUSTOM = '__custom__'

export default function PortfolioSettingsPage() {
  const router = useRouter()
  const [lang] = useState(() =>
    typeof window !== 'undefined' ? readInitialBookingLanguage() : 'en'
  )
  const t = useMemo(() => getBookingTranslations(lang), [lang])
  const p = t.portfolio

  const [token, setToken] = useState(null)
  const [businesses, setBusinesses] = useState([])
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [photos, setPhotos] = useState([])
  const [maxPhotos, setMaxPhotos] = useState(20)
  const [planKey, setPlanKey] = useState('starter')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [categorySelect, setCategorySelect] = useState(PORTFOLIO_PRESET_CATEGORY_KEYS[0])
  const [categoryCustom, setCategoryCustom] = useState('')

  const fileRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tok = localStorage.getItem('book8_token')
    setToken(tok)
    if (!tok) router.replace('/')
  }, [router])

  const loadBusinesses = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/business/register', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load')
    const list = data.businesses || []
    setBusinesses(list)
    if (list.length) {
      setSelectedBusinessId((prev) =>
        prev && list.some((b) => b.businessId === prev) ? prev : list[0].businessId
      )
    }
  }, [token])

  const loadPortfolio = useCallback(async () => {
    if (!token || !selectedBusinessId) return
    setLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/portfolio`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || p.loadError)
      setPhotos(Array.isArray(data.photos) ? data.photos : [])
      setMaxPhotos(data.maxPhotos ?? 20)
      setPlanKey(normalizePlanKey(data.planKey))
    } catch (e) {
      setMessage({ type: 'error', text: e.message || p.loadError })
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [token, selectedBusinessId, p.loadError])

  useEffect(() => {
    if (token) loadBusinesses()
  }, [token, loadBusinesses])

  useEffect(() => {
    if (token && selectedBusinessId) loadPortfolio()
  }, [token, selectedBusinessId, loadPortfolio])

  const resetPicker = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setPendingFile(null)
    setCaption('')
    setCategorySelect(PORTFOLIO_PRESET_CATEGORY_KEYS[0])
    setCategoryCustom('')
    setPickerOpen(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPickFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes((f.type || '').toLowerCase())) {
      setMessage({ type: 'error', text: 'Use PNG, JPG, or WebP.' })
      return
    }
    if (f.size > PORTFOLIO_MAX_FILE_BYTES) {
      setMessage({ type: 'error', text: 'Max file size is 5MB.' })
      return
    }
    setMessage({ type: '', text: '' })
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
    setPendingFile(f)
    setPickerOpen(true)
  }

  const categoryValue = () => {
    if (categorySelect === CUSTOM) return categoryCustom.trim().slice(0, 80)
    const labels = p.categories || {}
    return (labels[categorySelect] || categorySelect).slice(0, 80)
  }

  const confirmUpload = async () => {
    if (!token || !selectedBusinessId || !pendingFile) return
    if (photos.length >= maxPhotos) return
    setUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('caption', caption.trim().slice(0, 200))
      fd.append('category', categoryValue())
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/portfolio`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || p.uploadError)
      setPhotos(Array.isArray(data.photos) ? data.photos : [])
      resetPicker()
    } catch (e) {
      setMessage({ type: 'error', text: e.message || p.uploadError })
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async (photoId) => {
    if (!token || !selectedBusinessId) return
    if (!window.confirm(p.deleteConfirm)) return
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/portfolio?photoId=${encodeURIComponent(photoId)}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || p.deleteError)
      setPhotos(Array.isArray(data.photos) ? data.photos : [])
    } catch (e) {
      setMessage({ type: 'error', text: e.message || p.deleteError })
    }
  }

  const reorder = async (orderedIds) => {
    if (!token || !selectedBusinessId) return
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(selectedBusinessId)}/portfolio`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderedIds })
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || p.reorderError)
      setPhotos(Array.isArray(data.photos) ? data.photos : [])
    } catch (e) {
      setMessage({ type: 'error', text: e.message || p.reorderError })
    }
  }

  const move = (idx, dir) => {
    const next = [...photos]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    ;[next[idx], next[j]] = [next[j], next[idx]]
    reorder(next.map((x) => String(x.id)))
  }

  const isStarter = planKey === 'starter'

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/settings" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Camera className="h-7 w-7" />
            {p.manageTitle}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{p.manageSubtitle}</p>
        </div>

        {isStarter ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="pt-6 text-sm">
              <p className="text-amber-800 dark:text-amber-200">{p.upgradeForMore}</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/settings/billing">View plans</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {businesses.length > 1 ? (
          <div>
            <Label>Business</Label>
            <select
              className="mt-1 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.businessId} value={b.businessId}>
                  {b.name} ({b.businessId})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {trFormat(p.maxPhotos, { count: String(photos.length), max: String(maxPhotos) })}
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <Button
              type="button"
              disabled={photos.length >= maxPhotos || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {p.uploadPhoto}
            </Button>
          </div>
        </div>

        {message.text ? (
          <p
            className={`text-sm ${
              message.type === 'error' ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {message.text}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">{p.dragToReorder}</p>

        {pickerOpen && previewUrl ? (
          <Card>
            <CardHeader>
              <CardTitle>{p.previewTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="max-h-64 rounded-lg object-contain border" />
              <div>
                <Label htmlFor="cap">{p.caption}</Label>
                <Input
                  id="cap"
                  value={caption}
                  maxLength={200}
                  onChange={(e) => setCaption(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{p.category}</Label>
                <Select value={categorySelect} onValueChange={setCategorySelect}>
                  <SelectTrigger className="mt-1 w-full max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTFOLIO_PRESET_CATEGORY_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {(p.categories && p.categories[key]) || key}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>{p.customCategory}</SelectItem>
                  </SelectContent>
                </Select>
                {categorySelect === CUSTOM ? (
                  <Input
                    className="mt-2 max-w-md"
                    placeholder={p.customCategoryPlaceholder}
                    value={categoryCustom}
                    maxLength={80}
                    onChange={(e) => setCategoryCustom(e.target.value)}
                  />
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button onClick={confirmUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : p.confirmUpload}
                </Button>
                <Button type="button" variant="outline" onClick={resetPicker} disabled={uploading}>
                  {p.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo, idx) => (
              <Card key={photo.id} className="overflow-hidden pt-0">
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photo.caption ? (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-2">
                      <p className="text-white text-xs line-clamp-2">{photo.caption}</p>
                    </div>
                  ) : null}
                </div>
                <CardContent className="p-3 space-y-2">
                  {photo.category ? (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {photo.category}
                    </span>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === 0}
                      onClick={() => move(idx, -1)}
                      aria-label={p.moveUp}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={idx === photos.length - 1}
                      onClick={() => move(idx, 1)}
                      aria-label={p.moveDown}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePhoto(String(photo.id))}
                      aria-label={p.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{p.uploadPhoto}</p>
        ) : null}
      </div>
    </main>
  )
}
