'use client'

import React, { useMemo, useState } from 'react'
import { MapPin, Phone, Mail, Globe, Clock, ChevronDown, ChevronUp, Facebook } from 'lucide-react'
import {
  googleMapsSearchUrl,
  getLocalDayKeyInTimeZone,
  weeklyHoursForDisplay,
  businessProfileHasPublicDisplay
} from '@/lib/businessProfile'
import { trFormat } from '@/lib/translations'

function InstagramIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-.001 2.881 1.44 1.44 0 01.001-2.881z" />
    </svg>
  )
}

function TikTokIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

function sanitizeTel(phone) {
  if (!phone) return ''
  return String(phone).replace(/[^\d+]/g, '')
}

function socialUrl(network, raw) {
  const v = String(raw || '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  const clean = v.replace(/^@+/, '').replace(/^\//, '')
  if (network === 'instagram') return `https://www.instagram.com/${clean.replace(/\/$/, '')}/`
  if (network === 'tiktok') return `https://www.tiktok.com/@${clean.replace(/^@/, '')}`
  if (network === 'facebook') {
    if (clean.includes('.')) return `https://${clean}`
    return `https://www.facebook.com/${clean}`
  }
  return null
}

/** @param {{ businessProfile: any, businessDisplayName: string, businessTimeZone?: string, t: import('@/lib/translations').BookingTranslations }} props */
export default function PublicBusinessInfoPanel({ businessProfile, businessDisplayName, businessTimeZone, t }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [weekExpanded, setWeekExpanded] = useState(false)

  const hasContent = useMemo(
    () => businessProfile && businessProfileHasPublicDisplay(businessProfile),
    [businessProfile]
  )

  const mapsUrl = useMemo(() => (businessProfile ? googleMapsSearchUrl(businessProfile) : null), [businessProfile])

  const tz = businessTimeZone || 'UTC'
  const todayKey = useMemo(() => getLocalDayKeyInTimeZone(tz), [tz])
  const dayLabels = useMemo(
    () => ({
      sunday: t.sunday,
      monday: t.monday,
      tuesday: t.tuesday,
      wednesday: t.wednesday,
      thursday: t.thursday,
      friday: t.friday,
      saturday: t.saturday
    }),
    [t]
  )

  const hoursDisplay = useMemo(
    () =>
      weeklyHoursForDisplay(businessProfile?.weeklyHours, todayKey, {
        dayLabels,
        closedLabel: t.closed
      }),
    [businessProfile, todayKey, dayLabels, t.closed]
  )

  if (!hasContent) return null

  const p = businessProfile
  const addrLines = [p.street, p.street2].filter(Boolean)
  const cityPart = [p.city, [p.provinceState, p.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const body = (
    <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4 md:p-5 space-y-4 text-sm text-gray-200">
      <div className="flex items-start gap-3">
        {p.logo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.logo.url}
            alt={
              businessDisplayName?.trim()
                ? `${businessDisplayName.trim()} logo`
                : 'Business logo'
            }
            className="w-12 h-12 shrink-0 rounded-full object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-white">
            {businessDisplayName?.trim()
              ? trFormat(t.aboutBusiness, { name: businessDisplayName.trim() })
              : t.aboutThisBusiness}
          </h2>
          {p.description ? <p className="text-gray-400 mt-2 text-sm leading-relaxed">{p.description}</p> : null}
        </div>
      </div>

      <div className="space-y-3">
        {mapsUrl && (addrLines.length || cityPart || p.country) ? (
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" aria-hidden />
            <div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-300 hover:text-violet-200 underline underline-offset-2"
              >
                {addrLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
                {cityPart ? <span className="block">{cityPart}</span> : null}
              </a>
            </div>
          </div>
        ) : null}

        {p.phone ? (
          <div className="hidden md:flex items-center gap-2">
            <Phone className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
            <a href={`tel:${sanitizeTel(p.phone)}`} className="text-white hover:text-violet-200">
              {p.phone}
            </a>
          </div>
        ) : null}

        {p.email ? (
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
            <a href={`mailto:${encodeURIComponent(p.email)}`} className="text-violet-300 hover:underline truncate">
              {p.email}
            </a>
          </div>
        ) : null}

        {p.website ? (
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 hover:underline truncate"
            >
              {p.website.replace(/^https?:\/\//i, '')}
            </a>
          </div>
        ) : null}

        {hoursDisplay.today || hoursDisplay.week.some((d) => !d.isClosed) ? (
          <div className="flex gap-2">
            <Clock className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              {hoursDisplay.today ? (
                <p className="text-white font-medium">
                  {trFormat(t.todayHours, { day: hoursDisplay.today.label })}{' '}
                  <span className="font-normal text-gray-300">{hoursDisplay.today.text}</span>
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setWeekExpanded((e) => !e)}
                className="text-xs text-violet-400 hover:text-violet-300 mt-1"
              >
                {weekExpanded ? t.hideFullWeek : t.seeFullWeek}
              </button>
              {weekExpanded ? (
                <ul className="mt-2 space-y-1 text-gray-400 text-xs">
                  {hoursDisplay.week.map((row) => (
                    <li key={row.key} className="flex justify-between gap-2">
                      <span>{row.label}</span>
                      <span className="text-gray-300 shrink-0">{row.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {p.social && (p.social.instagram || p.social.facebook || p.social.tiktok) ? (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{t.social}</span>
            <div className="flex gap-2">
              {p.social.instagram && socialUrl('instagram', p.social.instagram) ? (
                <a
                  href={socialUrl('instagram', p.social.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-800 text-pink-400 hover:bg-gray-700"
                  aria-label="Instagram"
                >
                  <InstagramIcon />
                </a>
              ) : null}
              {p.social.facebook && socialUrl('facebook', p.social.facebook) ? (
                <a
                  href={socialUrl('facebook', p.social.facebook)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-800 text-blue-400 hover:bg-gray-700"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              ) : null}
              {p.social.tiktok && socialUrl('tiktok', p.social.tiktok) ? (
                <a
                  href={socialUrl('tiktok', p.social.tiktok)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
                  aria-label="TikTok"
                >
                  <TikTokIcon />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <aside className="lg:sticky lg:top-4 self-start w-full order-1 lg:order-none">
      {p.phone ? (
        <div className="md:hidden mb-3 flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3">
          <Phone className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
          <a href={`tel:${sanitizeTel(p.phone)}`} className="text-white text-sm font-medium hover:text-violet-200">
            {p.phone}
          </a>
        </div>
      ) : null}
      <div className="md:hidden mb-3">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="w-full flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/80 px-4 py-3 text-left"
          aria-expanded={mobileOpen}
        >
          <span className="font-medium text-white text-sm">{t.businessDetailsContact}</span>
          {mobileOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
      </div>
      <div className={mobileOpen ? 'block md:block' : 'hidden md:block'}>{body}</div>
    </aside>
  )
}
