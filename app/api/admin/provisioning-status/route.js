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
  if (!token) return { payload: null, user: null }
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = database
      ? await database.collection('users').findOne({ id: payload.sub })
      : null
    return { payload, user }
  } catch {
    return { payload: null, user: null }
  }
}

function subscriptionOk(business, user) {
  const sub = business?.subscription
  const status = sub?.status || ''
  const plan = sub?.plan || business?.plan || ''
  if (['active', 'trialing'].includes(status)) return true
  if (['starter', 'growth', 'enterprise'].includes(String(plan).toLowerCase())) return true
  const uSub = user?.subscription
  const uStatus = uSub?.status || ''
  if (['active', 'trialing'].includes(uStatus)) return true
  return false
}

function calendarOk(business, user) {
  if (business?.calendar?.connected) return true
  if (user?.google?.refreshToken) return true
  if (user?.microsoft?.refreshToken || user?.outlook?.refreshToken) return true
  return false
}

export async function GET(request) {
  try {
    const database = await connect()
    const { payload, user } = await verifyAuth(request, database)

    if (!payload?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const business = await database
      .collection(BUSINESS_COLLECTION)
      .find({ ownerUserId: payload.sub })
      .sort({ createdAt: -1 })
      .limit(1)
      .next()

    if (!business) {
      return NextResponse.json({
        ok: false,
        status: 'NO_BUSINESS',
        message: 'No business found for this account',
        dashboardChecks: {},
        coreApi: { reachable: false, status: 'UNKNOWN', message: 'No business', checks: null }
      })
    }

    const businessId = business.businessId || business.id

    const dashboardChecks = {
      business_record: {
        ok: true,
        detail: `${business.name} (${business.category || 'uncategorized'})`
      },
      subscription: {
        ok: subscriptionOk(business, user),
        detail: business.subscription?.status
          ? `${business.subscription.plan || business.plan || 'unknown'} plan — ${business.subscription.status}`
          : user?.subscription?.status
            ? `User subscription — ${user.subscription.status}`
            : 'No active subscription on business'
      },
      calendar_connection: {
        ok: calendarOk(business, user),
        detail: business.calendar?.connected
          ? `${business.calendar.provider || 'calendar'} — connected`
          : user?.google?.refreshToken
            ? 'Google connected on account'
            : 'Not connected (optional for some flows)'
      },
      handle: {
        ok: !!business.handle,
        detail: business.handle ? `book8.io/b/${business.handle}` : 'No booking page handle set'
      },
      timezone: {
        ok: !!(business.timezone || user?.scheduling?.timeZone),
        detail: business.timezone || user?.scheduling?.timeZone || 'Not set'
      }
    }

    const coreBase = (env.CORE_API_BASE_URL || 'https://book8-core-api.onrender.com').replace(
      /\/$/,
      ''
    )
    const secret = env.CORE_API_INTERNAL_SECRET || env.OPS_INTERNAL_SECRET || ''

    let coreApiChecks = null
    let coreApiStatus = 'UNKNOWN'
    let coreApiMessage = 'Could not reach core-api'
    let coreApiReachable = false

    if (!secret) {
      coreApiMessage = 'CORE_API_INTERNAL_SECRET not configured'
    } else {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 10000)
        const healthRes = await fetch(`${coreBase}/api/health/business/${encodeURIComponent(businessId)}`, {
          headers: {
            'x-book8-internal-secret': secret,
            'x-internal-secret': secret
          },
          signal: controller.signal
        })
        clearTimeout(t)

        if (healthRes.ok) {
          coreApiReachable = true
          const healthData = await healthRes.json().catch(() => ({}))
          coreApiChecks = healthData.checks ?? null
          coreApiStatus = healthData.status || 'OK'
          coreApiMessage = healthData.message || 'OK'
        } else {
          const text = await healthRes.text().catch(() => '')
          coreApiMessage = `Core API returned ${healthRes.status}${text ? `: ${text.slice(0, 200)}` : ''}`
        }
      } catch (fetchErr) {
        coreApiMessage = `Core API unreachable: ${fetchErr.message || fetchErr}`
      }
    }

    const dashboardOk =
      dashboardChecks.business_record.ok && dashboardChecks.subscription.ok
    const coreApiOk =
      coreApiReachable &&
      (coreApiStatus === 'FULLY_PROVISIONED' ||
        coreApiStatus === 'PARTIALLY_PROVISIONED' ||
        coreApiStatus === 'OK' ||
        coreApiStatus === 'HEALTHY')
    const overallOk = dashboardOk && coreApiOk

    return NextResponse.json({
      ok: overallOk,
      businessId,
      businessName: business.name,
      overallStatus: overallOk ? 'HEALTHY' : 'NEEDS_ATTENTION',
      dashboardChecks,
      coreApi: {
        reachable: coreApiReachable,
        status: coreApiStatus,
        message: coreApiMessage,
        checks: coreApiChecks
      }
    })
  } catch (err) {
    console.error('[provisioning-status] Error:', err)
    return NextResponse.json(
      { ok: false, error: err.message || 'Server error' },
      { status: 500 }
    )
  }
}
