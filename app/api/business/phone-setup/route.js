import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME as BUSINESS_COLLECTION } from '@/lib/schemas/business'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

async function verifyAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return { payload: null, user: null }
  }

  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await database.collection('users').findOne({ id: payload.sub })
    return { payload, user }
  } catch {
    return { payload: null, user: null }
  }
}

function getCoreApiConfig() {
  const baseUrl =
    env.CORE_API_BASE_URL ||
    process.env.CORE_API_URL ||
    'https://book8-core-api.onrender.com'

  const secret =
    env.CORE_API_INTERNAL_SECRET ||
    process.env.CORE_API_INTERNAL_SECRET ||
    process.env.INTERNAL_API_SECRET ||
    ''

  return { baseUrl, secret }
}

export async function GET(request) {
  try {
    const database = await connect()
    const { payload } = await verifyAuth(request, database)

    if (!payload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const businessId = url.searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }

    const business = await database
      .collection(BUSINESS_COLLECTION)
      .findOne({ businessId })

    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }

    if (business.ownerUserId !== payload.sub) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const { baseUrl, secret } = getCoreApiConfig()
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: 'CORE_API_INTERNAL_SECRET not configured' },
        { status: 500 }
      )
    }

    const coreRes = await fetch(`${baseUrl}/api/businesses/${businessId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret
      },
      cache: 'no-store'
    })

    if (!coreRes.ok) {
      const text = await coreRes.text().catch(() => '')
      console.error('[business/phone-setup] Core API GET failed', {
        status: coreRes.status,
        body: text
      })
      return NextResponse.json(
        { ok: false, error: 'Failed to load phone setup from core-api' },
        { status: 502 }
      )
    }

    const data = await coreRes.json()

    return NextResponse.json({
      ok: true,
      businessId,
      name: data.name,
      forwardingEnabled: data.forwardingEnabled ?? false,
      forwardingFrom: data.forwardingFrom ?? [],
      assignedTwilioNumber: data.assignedTwilioNumber ?? null,
      phoneNumber: data.phoneNumber ?? null,
      numberSetupMethod: data.numberSetupMethod ?? null
    })
  } catch (error) {
    console.error('[business/phone-setup] GET error', error)
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const database = await connect()
    const { payload } = await verifyAuth(request, database)

    if (!payload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const {
      businessId,
      numberSetupMethod,
      forwardingEnabled,
      forwardingFrom,
      phoneNumber
    } = body || {}

    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }

    if (!numberSetupMethod) {
      return NextResponse.json(
        { ok: false, error: 'numberSetupMethod is required' },
        { status: 400 }
      )
    }

    const business = await database
      .collection(BUSINESS_COLLECTION)
      .findOne({ businessId })

    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }

    if (business.ownerUserId !== payload.sub) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    const { baseUrl, secret } = getCoreApiConfig()
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: 'CORE_API_INTERNAL_SECRET not configured' },
        { status: 500 }
      )
    }

    const updatePayload = {
      id: businessId,
      name: business.name,
      numberSetupMethod,
      forwardingEnabled: !!forwardingEnabled,
      forwardingFrom: Array.isArray(forwardingFrom)
        ? forwardingFrom
        : forwardingFrom
        ? [forwardingFrom]
        : [],
      phoneNumber: phoneNumber || null
    }

    const coreRes = await fetch(`${baseUrl}/api/businesses/${businessId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret
      },
      body: JSON.stringify(updatePayload)
    })

    const result = await coreRes.json().catch(() => ({}))

    if (!coreRes.ok) {
      console.error('[business/phone-setup] Core API POST failed', {
        status: coreRes.status,
        error: result?.error
      })
      return NextResponse.json(
        { ok: false, error: 'Failed to update phone setup in core-api' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      businessId,
      result
    })
  } catch (error) {
    console.error('[business/phone-setup] POST error', error)
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 }
    )
  }
}

