/**
 * GET /api/business/[businessId]
 * 
 * Get business details and status.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'

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

async function verifyAuth(request, database) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { payload: null, user: null }
  
  const jwt = (await import('jsonwebtoken')).default
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = database ? await database.collection('users').findOne({ id: payload.sub }) : null
    return { payload, user }
  } catch {
    return { payload: null, user: null }
  }
}

export async function GET(request, { params }) {
  try {
    const { businessId } = params
    
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }
    
    const database = await connect()
    const { payload: authPayload } = await verifyAuth(request, database)
    
    if (!authPayload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const userId = authPayload.sub
    
    const business = await database.collection(COLLECTION_NAME).findOne({ businessId })
    
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }
    
    if (business.ownerUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({
      ok: true,
      business: {
        businessId: business.businessId,
        name: business.name,
        status: business.status,
        statusReason: business.statusReason,
        subscription: {
          status: business.subscription?.status || 'none',
          stripeCustomerId: business.subscription?.stripeCustomerId ? '***' + business.subscription.stripeCustomerId.slice(-4) : null
        },
        calendar: {
          connected: business.calendar?.connected || false,
          provider: business.calendar?.provider
        },
        provisioningOptions: business.provisioningOptions,
        features: business.features || {
          voiceEnabled: false,
          billingEnabled: false,
          agentEnabled: false
        },
        ops: {
          lastRequestId: business.ops?.lastRequestId,
          lastRequestType: business.ops?.lastRequestType,
          lastRequestStatus: business.ops?.lastRequestStatus,
          lastRequestAt: business.ops?.lastRequestAt,
          approvalRequestId: business.ops?.approvalRequestId,
          provisionedAt: business.ops?.provisionedAt,
          lastError: business.ops?.lastError
        },
        createdAt: business.createdAt,
        updatedAt: business.updatedAt
      }
    })
    
  } catch (error) {
    console.error('[business/[businessId]] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
