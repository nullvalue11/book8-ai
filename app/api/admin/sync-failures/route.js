/**
 * GET /api/admin/sync-failures
 * Lists subscription-sync dead-letter rows (BOO-44B).
 *
 * Auth: x-admin-token: ADMIN_TOKEN (same as other /api/admin/stripe routes)
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/auth-utils'
import { SYNC_FAILURES_COLLECTION } from '@/models/SyncFailure'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client
let db

async function connect() {
  if (!client) {
    if (!env.MONGO_URL) throw new Error('MONGO_URL missing')
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

function verifyAdminToken(request) {
  const adminToken = env.ADMIN_TOKEN
  if (!adminToken) {
    return { valid: false, error: 'ADMIN_TOKEN not configured' }
  }
  const providedToken = request.headers.get('x-admin-token')
  if (!providedToken) {
    return { valid: false, error: 'Missing x-admin-token header' }
  }
  if (!safeCompare(providedToken, adminToken)) {
    return { valid: false, error: 'Invalid admin token' }
  }
  return { valid: true }
}

export async function GET(request) {
  try {
    const authCheck = verifyAdminToken(request)
    if (!authCheck.valid) {
      return NextResponse.json({ ok: false, error: authCheck.error }, { status: 401 })
    }

    const database = await connect()
    const url = new URL(request.url)
    const resolvedParam = url.searchParams.get('resolved')
    const businessId = url.searchParams.get('businessId')
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10), 1), 500)

    const query = {}
    if (businessId) query.businessId = businessId
    if (resolvedParam === 'true') query.resolved = true
    else if (resolvedParam === 'false' || resolvedParam === null) query.resolved = false

    const failures = await database
      .collection(SYNC_FAILURES_COLLECTION)
      .find(query)
      .sort({ attemptedAt: -1 })
      .limit(limit)
      .toArray()

    const count = await database.collection(SYNC_FAILURES_COLLECTION).countDocuments(query)

    const cleaned = failures.map(({ _id, ...rest }) => ({
      ...rest,
      _id: _id?.toString?.() ?? _id
    }))

    return NextResponse.json({
      ok: true,
      failures: cleaned,
      count
    })
  } catch (e) {
    console.error('[admin/sync-failures]', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
