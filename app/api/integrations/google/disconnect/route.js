import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env'
import { syncCalendarToCore } from '@/lib/sync-calendar-to-core'

export const runtime = 'nodejs'

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

function getJwtSecret() {
  return env.JWT_SECRET
}

async function requireAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { error: 'Missing Authorization header', status: 401 }
  try {
    const payload = jwt.verify(token, getJwtSecret())
    const user = await database.collection('users').findOne({ id: payload.sub })
    if (!user) return { error: 'User not found', status: 401 }
    return { payload, user }
  } catch {
    return { error: 'Invalid or expired token', status: 401 }
  }
}

export async function POST(request) {
  try {
    const database = await connect()
    const auth = await requireAuth(request, database)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })

    const userId = auth.payload.sub

    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const businessId = body?.businessId || null
    const now = new Date()

    await database.collection('users').updateOne(
      { id: userId },
      {
        $set: {
          'google.refreshToken': null,
          'google.connected': false,
          'google.needsReconnect': false,
          'google.connectedAt': null,
          'google.lastSyncedAt': null,
          'google.lastError': null,
          updatedAt: now
        }
      }
    )

    const bizFilter = {
      ownerUserId: userId,
      'calendar.provider': 'google'
    }
    if (businessId) bizFilter.businessId = businessId

    const affected = await database
      .collection('businesses')
      .find(bizFilter)
      .project({ businessId: 1, id: 1 })
      .toArray()

    await database.collection('businesses').updateMany(bizFilter, {
      $set: {
        'calendar.connected': false,
        'calendar.provider': null,
        'calendar.calendarId': null,
        updatedAt: now
      }
    })

    for (const biz of affected) {
      const bizId = biz.businessId || biz.id
      if (bizId) {
        await syncCalendarToCore({
          businessId: bizId,
          provider: null,
          connected: false
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[google/disconnect] error', e)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

