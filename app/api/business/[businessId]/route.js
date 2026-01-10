/**
 * GET /api/business/[businessId]
 * 
 * Get business details and status.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { verifyToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { COLLECTION_NAME } from '@/lib/schemas/business'

export const dynamic = 'force-dynamic'

let cachedClient = null

async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(env.MONGO_URL)
    await cachedClient.connect()
  }
  return cachedClient.db()
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
    
    // Authenticate
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    const payload = await verifyToken(token)
    
    if (!payload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    const userId = payload.sub
    
    // Get business
    const db = await getDb()
    const business = await db.collection(COLLECTION_NAME).findOne({ businessId })
    
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found' },
        { status: 404 }
      )
    }
    
    // Verify ownership
    if (business.ownerUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }
    
    // Return business details
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
