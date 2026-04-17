/**
 * GET /api/public/services?handle=xxx
 * Returns services for a business by handle (no auth required for public booking page)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { GOOGLE_MAPS_BROWSER_KEY } from '@/lib/publicRuntimeConfig'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'
import {
  getPlanFeatures,
  hasVoiceOrSmsBooking,
  normalizePlanKey
} from '@/lib/plan-features'
import { sanitizeBusinessProfileForPublic } from '@/lib/businessProfile'
import { sanitizeProvidersForPublic } from '@/lib/staff-providers'
import { sanitizeNoShowForPublic } from '@/lib/no-show-protection'
import { sanitizeGooglePlacesForPublic } from '@/lib/googlePlaces'
import { sanitizePortfolioForPublic } from '@/lib/portfolio'
import { REVIEWS_COLLECTION, aggregatePublishedReviews } from '@/lib/reviews'

function slugifyEmbeddedServiceId(name, i) {
  const s = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return s || `svc_${i}`
}

/** Mongo-embedded `business.services` → core-shaped rows for /b/[handle] when core has none (OPTION-D demo). */
function normalizeEmbeddedPublicServices(rawList) {
  if (!Array.isArray(rawList) || rawList.length === 0) return []
  return rawList.map((s, i) => {
    const name = String(s.name || '').trim() || `Service ${i + 1}`
    const durationMinutes = Math.max(5, Math.floor(Number(s.durationMinutes) || 30))
    const price = s.price != null && !Number.isNaN(Number(s.price)) ? Number(s.price) : null
    const currency = typeof s.currency === 'string' && s.currency.trim() ? s.currency.trim() : 'CAD'
    const sid =
      (typeof s.serviceId === 'string' && s.serviceId.trim()) ||
      (typeof s.id === 'string' && s.id.trim()) ||
      `svc_book8demo_${slugifyEmbeddedServiceId(name, i)}`
    return {
      serviceId: sid,
      id: sid,
      name,
      durationMinutes,
      price,
      currency
    }
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

export async function GET(request) {
  try {
    const url = new URL(request.url)
    const handle = url.searchParams.get('handle')
    if (!handle) {
      return NextResponse.json({ ok: false, error: 'handle parameter required' }, { status: 400 })
    }

    const database = await connect()
    const business = await findBusinessByPublicHandle(database.collection(BUSINESS_COLLECTION), handle)

    if (!business) {
      return NextResponse.json({ ok: false, error: 'Business not found' }, { status: 404 })
    }

    const baseUrl = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(/\/$/, '')

    // Do NOT send BOOK8_CORE_API_KEY here: core-api returns only active services for unauthenticated
    // GET /services. With the API key, the same endpoint returns *all* services (dashboard use),
    // which would show deactivated services on the public booking page (book8.io/b/...).
    const res = await fetch(`${baseUrl}/api/businesses/${business.businessId}/services`, {
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })

    const data = await res.json().catch(() => ({}))

    // core-api may return { services: [...] } or array directly
    let services = Array.isArray(data) ? data : (data?.services || [])
    const embedded = normalizeEmbeddedPublicServices(business.services)

    if (business.isDemo && embedded.length > 0) {
      services = embedded
    } else if ((!res.ok || services.length === 0) && embedded.length > 0) {
      services = embedded
    } else if (!res.ok) {
      return NextResponse.json(
        data?.error ? { ok: false, error: data.error } : { ok: false, error: 'Failed to load services' },
        { status: res.status }
      )
    }

    const plan = normalizePlanKey(business.plan || business.subscription?.plan)
    const multilingual = !!getPlanFeatures(plan).multilingual || !!business.isDemo
    const bookingPhone =
      business.assignedTwilioNumber ||
      business.phone ||
      business.assigned_twilio_number ||
      null
    const showPhoneBookingChannel = hasVoiceOrSmsBooking(plan) && !!bookingPhone

    const businessProfile = sanitizeBusinessProfileForPublic(business.businessProfile)
    const providers = sanitizeProvidersForPublic(business.providers || [], plan)
    const noShowProtection = sanitizeNoShowForPublic(business)

    const revRows = await database
      .collection(REVIEWS_COLLECTION)
      .find({ businessId: business.businessId, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
    const reviewsSummary = aggregatePublishedReviews(revRows, 100)

    const googlePlaceId =
      (typeof business.googlePlaceId === 'string' && business.googlePlaceId.trim()) ||
      (business.googlePlaces &&
        typeof business.googlePlaces === 'object' &&
        typeof business.googlePlaces.placeId === 'string' &&
        business.googlePlaces.placeId.trim()) ||
      null

    return NextResponse.json({
      ok: true,
      services,
      isDemo: !!business.isDemo,
      businessId: business.businessId,
      googlePlaceId,
      /** BOO-106B: domain-restricted key for Static Maps img on /b/[handle] (same as publicRuntimeConfig GOOGLE_MAPS_BROWSER_KEY) */
      mapsBrowserKey: GOOGLE_MAPS_BROWSER_KEY || null,
      businessName: business.name || null,
      category: business.category || null,
      city: business.city || null,
      businessTimezone: business.timezone || null,
      businessProfile,
      googlePlaces: sanitizeGooglePlacesForPublic(business.googlePlaces),
      portfolio: sanitizePortfolioForPublic(business.portfolio),
      reviews: reviewsSummary,
      providers,
      noShowProtection,
      plan,
      multilingual,
      bookingPhone: showPhoneBookingChannel ? bookingPhone : null,
      waitlistEnabled: business.waitlistEnabled !== false
    })
  } catch (error) {
    console.error('[public/services] Error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
