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
  if (!token) return { payload: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return { payload }
  } catch {
    return { payload: null }
  }
}

export async function POST(request) {
  try {
    const database = await connect()
    const { payload } = await verifyAuth(request, database)

    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const { businessId } = body || {}
    if (!businessId) {
      return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
    }

    const business = await database.collection(BUSINESS_COLLECTION).findOne({
      $or: [{ businessId }, { id: businessId }],
      ownerUserId: payload.sub
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const N8N_URL =
      env.N8N_PROVISIONING_CHECK_URL || 'https://n8n.book8.io/webhook/provisioning-check'
    const N8N_SECRET = env.N8N_OPS_SECRET
    if (!N8N_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'Provisioning retry not configured (set N8N_OPS_SECRET)' },
        { status: 503 }
      )
    }

    const retryRes = await fetch(N8N_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ops-secret': N8N_SECRET
      },
      body: JSON.stringify({ businessId }),
      signal: AbortSignal.timeout(45000)
    })

    const text = await retryRes.text().catch(() => '')
    let retryData
    try {
      retryData = text ? JSON.parse(text) : { ok: false, error: 'Empty response' }
    } catch {
      retryData = { ok: false, error: text || 'Invalid response' }
    }

    return NextResponse.json(retryData, { status: retryRes.ok ? 200 : retryRes.status })
  } catch (err) {
    console.error('[provisioning-retry] Error:', err)
    return NextResponse.json(
      { ok: false, error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
