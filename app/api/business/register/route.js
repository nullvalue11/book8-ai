/**
 * POST /api/business/register
 * 
 * Register a new business and preview the provisioning plan.
 * 
 * This endpoint:
 * 1. Validates input
 * 2. Creates/updates Business record with status='pending'
 * 3. Calls tenant.bootstrap in PLAN mode (dryRun=true)
 * 4. Returns the plan for user review
 * 
 * The user must then call /api/business/confirm to execute the plan.
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { 
  createBusiness, 
  validateBusinessInput, 
  generateBusinessId,
  updateBusinessOps,
  BUSINESS_STATUS,
  COLLECTION_NAME 
} from '@/lib/schemas/business'

export const dynamic = 'force-dynamic'

/**
 * Generate unique request ID for ops tracking
 */
function generateRequestId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `web-${timestamp}-${random}`
}

/**
 * Call Ops Control Plane
 */
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
    // 1. Authenticate user
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
    const userEmail = payload.email
    
    // 2. Parse and validate input
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
    
    // 3. Get database
    const db = await getDb()
    const collection = db.collection(COLLECTION_NAME)
    
    // 4. Generate or use provided business ID
    const businessId = inputBusinessId || generateBusinessId()
    
    // 5. Check if business ID already exists
    const existing = await collection.findOne({ businessId })
    if (existing) {
      // If it exists and belongs to this user, allow re-planning
      if (existing.ownerUserId !== userId) {
        return NextResponse.json(
          { ok: false, error: 'Business ID already exists' },
          { status: 409 }
        )
      }
      
      // If already ready, don't allow re-registration
      if (existing.status === BUSINESS_STATUS.READY) {
        return NextResponse.json(
          { ok: false, error: 'Business already provisioned', business: existing },
          { status: 409 }
        )
      }
    }
    
    // 6. Check user's business limit (optional: implement limit per user)
    const userBusinessCount = await collection.countDocuments({ ownerUserId: userId })
    const MAX_BUSINESSES_PER_USER = 5 // Configurable
    if (!existing && userBusinessCount >= MAX_BUSINESSES_PER_USER) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_BUSINESSES_PER_USER} businesses per user` },
        { status: 400 }
      )
    }
    
    // 7. Generate request ID for ops tracking
    const requestId = generateRequestId()
    
    // 8. Call Ops Control Plane in PLAN mode
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
    
    // 9. Create or update business record
    const businessData = existing || createBusiness({
      businessId,
      name: name.trim(),
      ownerUserId: userId,
      ownerEmail: userEmail,
      skipVoiceTest,
      skipBillingCheck
    })
    
    // Update with latest data
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
    
    // Upsert business
    await collection.updateOne(
      { businessId },
      { $set: businessData },
      { upsert: true }
    )
    
    const durationMs = Date.now() - startTime
    
    // 10. Return plan for review
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
      _meta: {
        durationMs
      }
    })
    
  } catch (error) {
    console.error('[business/register] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * GET /api/business/register
 * 
 * Get user's businesses
 */
export async function GET(request) {
  try {
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
    
    // Get businesses
    const db = await getDb()
    const businesses = await db.collection(COLLECTION_NAME)
      .find({ ownerUserId: userId })
      .sort({ createdAt: -1 })
      .toArray()
    
    // Clean up for response
    const cleanedBusinesses = businesses.map(b => ({
      businessId: b.businessId,
      name: b.name,
      status: b.status,
      statusReason: b.statusReason,
      subscription: {
        status: b.subscription?.status || 'none'
      },
      calendar: {
        connected: b.calendar?.connected || false
      },
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
