/**
 * POST /api/business/:businessId/send-welcome
 * Internal/ops: force-send BOO-109A welcome email (Resend).
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { safeCompare } from '@/lib/auth-utils'
import { sendWelcomeEmailToBusiness } from '@/lib/welcomeEmail'

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

function authorizedByInternalSecret(request) {
  const raw = request.headers.get('x-book8-internal-secret')
  if (raw == null || typeof raw !== 'string') return false
  const header = raw.trim()
  if (!header) return false
  const internal = env.INTERNAL_API_SECRET
  const ops = env.OPS_INTERNAL_SECRET
  if (internal && safeCompare(header, internal)) return true
  if (ops && safeCompare(header, ops)) return true
  return false
}

export async function POST(request, { params }) {
  if (!authorizedByInternalSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { businessId } = params
  if (!businessId || typeof businessId !== 'string') {
    return NextResponse.json({ ok: false, error: 'businessId required' }, { status: 400 })
  }

  try {
    const database = await connect()
    const result = await sendWelcomeEmailToBusiness(database, businessId, { forceFire: true })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[send-welcome]', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
