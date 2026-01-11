/**
 * POST /api/business/register
 * 
 * Register a new business and preview the provisioning plan.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { 
  createBusiness, 
  validateBusinessInput, 
  generateBusinessId,
  updateBusinessOps,
  BUSINESS_STATUS,
  COLLECTION_NAME 
} from '@/lib/schemas/business'

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

function generateRequestId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `web-${timestamp}-${random}`
}

async function callOpsControlPlane(tool, payload, meta) {
  const baseUrl = env.BASE_URL || 'http://localhost:3000'
  const secret = env.OPS_INTERNAL_SECRET
  
  if (!secret) {
    throw new Error('OPS_INTERNAL_SECRET not configured')
  }
  
  const response = await fetch(`${baseUrl}/api/internal/ops/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-internal-secret': secret,
      'x-book8-caller': 'book8_app'
    },
    body: JSON.stringify({ tool, payload, meta }),
    cache: 'no-store'
  })
  
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error?.message || `Ops call failed with status ${response.status}`)
  }
  
  return data
}

export async function POST(request) {
  const startTime = Date.now()
  
  try {
    const database = await connect()
    const { payload: authPayload, user } = await verifyAuth(request, database)
    
    if (!authPayload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const userId = authPayload.sub
    const userEmail = authPayload.email || user?.email
    
    // Parse and validate input
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
      businessId: inputBusinessId,
      name, 
      skipVoiceTest = false, 
      skipBillingCheck = false 
    } = body
    
    const validation = validateBusinessInput({ name, businessId: inputBusinessId })
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: 'Validation failed', errors: validation.errors },
        { status: 400 }
      )
    }
    
    const collection = database.collection(COLLECTION_NAME)
    const businessId = inputBusinessId || generateBusinessId()
    
    // Check if business ID already exists
    const existing = await collection.findOne({ businessId })
    if (existing) {
      if (existing.ownerUserId !== userId) {
        return NextResponse.json(
          { ok: false, error: 'Business ID already exists' },
          { status: 409 }
        )
      }
      
      if (existing.status === BUSINESS_STATUS.READY) {
        return NextResponse.json(
          { ok: false, error: 'Business already provisioned', business: existing },
          { status: 409 }
        )
      }
    }
    
    // Check user's business limit
    const userBusinessCount = await collection.countDocuments({ ownerUserId: userId })
    const MAX_BUSINESSES_PER_USER = 5
    if (!existing && userBusinessCount >= MAX_BUSINESSES_PER_USER) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_BUSINESSES_PER_USER} businesses per user` },
        { status: 400 }
      )
    }
    
    const requestId = generateRequestId()
    
    // Call Ops Control Plane in PLAN mode
    let opsResult
    try {
      opsResult = await callOpsControlPlane(
        'tenant.bootstrap',
        {
          businessId,
          name: name.trim(),
          skipVoiceTest,
          skipBillingCheck
        },
        {
          requestId,
          mode: 'plan',
          dryRun: true
        }
      )
    } catch (opsError) {
      console.error('[business/register] Ops call failed:', opsError)
      return NextResponse.json({
        ok: false,
        error: 'Failed to generate provisioning plan',
        details: opsError.message
      }, { status: 500 })
    }
    
    // Create or update business record
    const businessData = existing || createBusiness({
      businessId,
      name: name.trim(),
      ownerUserId: userId,
      ownerEmail: userEmail,
      skipVoiceTest,
      skipBillingCheck
    })
    
    businessData.name = name.trim()
    businessData.provisioningOptions = { skipVoiceTest, skipBillingCheck }
    businessData.updatedAt = new Date()
    businessData.ops = updateBusinessOps(businessData, {
      requestId,
      requestType: 'plan',
      status: opsResult.ok ? 'success' : 'failed',
      result: opsResult.result || opsResult.plan,
      error: opsResult.ok ? null : opsResult.error
    })
    
    await collection.updateOne(
      { businessId },
      { $set: businessData },
      { upsert: true }
    )
    
    const durationMs = Date.now() - startTime
    
    return NextResponse.json({
      ok: true,
      businessId,
      name: businessData.name,
      status: businessData.status,
      requestId,
      plan: opsResult.result || opsResult.plan,
      provisioningOptions: businessData.provisioningOptions,
      message: 'Provisioning plan generated. Call /api/business/confirm to execute.',
      nextStep: {
        endpoint: '/api/business/confirm',
        method: 'POST',
        body: { businessId }
      },
      _meta: { durationMs }
    })
    
  } catch (error) {
    console.error('[business/register] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const database = await connect()
    const { payload: authPayload } = await verifyAuth(request, database)
    
    if (!authPayload?.sub) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const userId = authPayload.sub
    
    const businesses = await database.collection(COLLECTION_NAME)
      .find({ ownerUserId: userId })
      .sort({ createdAt: -1 })
      .toArray()
    
    const cleanedBusinesses = businesses.map(b => ({
      businessId: b.businessId,
      name: b.name,
      status: b.status,
      statusReason: b.statusReason,
      subscription: { status: b.subscription?.status || 'none' },
      calendar: { connected: b.calendar?.connected || false },
      provisioningOptions: b.provisioningOptions,
      ops: {
        lastRequestId: b.ops?.lastRequestId,
        lastRequestStatus: b.ops?.lastRequestStatus,
        provisionedAt: b.ops?.provisionedAt
      },
      createdAt: b.createdAt,
      updatedAt: b.updatedAt
    }))
    
    return NextResponse.json({
      ok: true,
      businesses: cleanedBusinesses,
      count: businesses.length
    })
    
  } catch (error) {
    console.error('[business/register GET] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
