/**
 * GET /api/public/services?handle=xxx
 * Returns services for a business by handle (no auth required for public booking page)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'
import { findBusinessByPublicHandle } from '@/lib/public-business-lookup'

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
    const apiKey = env.BOOK8_CORE_API_KEY || ''

    const res = await fetch(`${baseUrl}/api/businesses/${business.businessId}/services`, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-book8-api-key': apiKey })
      },
      cache: 'no-store'
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        data?.error ? { ok: false, error: data.error } : { ok: false, error: 'Failed to load services' },
        { status: res.status }
      )
    }

    // core-api may return { services: [...] } or array directly
    const services = Array.isArray(data) ? data : (data?.services || [])
    return NextResponse.json({
      ok: true,
      services,
      businessId: business.businessId,
      businessName: business.name || null,
      category: business.category || null,
      city: business.city || null
    })
  } catch (error) {
    console.error('[public/services] Error:', error)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
