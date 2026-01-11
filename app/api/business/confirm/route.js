/**
 * POST /api/business/confirm
 * 
 * Confirm and execute business provisioning.
 */

import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import { 
  updateBusinessOps,
  BUSINESS_STATUS,
  COLLECTION_NAME 
} from '@/lib/schemas/business'
import toolRegistry from '@/lib/ops/tool-registry'

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

async function callOpsControlPlane(endpoint, body) {
  const baseUrl = env.BASE_URL || 'http://localhost:3000'
  const secret = env.OPS_INTERNAL_SECRET
  
  if (!secret) {
    throw new Error('OPS_INTERNAL_SECRET not configured')
  }
  
  const url = `${baseUrl}/api/internal/ops${endpoint}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-internal-secret': secret,
      'x-book8-caller': 'book8_app'
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  })
  
  const data = await response.json()
  return { response, data, ok: response.ok }
}

async function triggerN8nWebhook(businessData, opsResult) {
  const webhookUrl = env.N8N_BUSINESS_PROVISIONED_WEBHOOK_URL
  
  if (!webhookUrl) {
    console.log('[business/confirm] N8N_BUSINESS_PROVISIONED_WEBHOOK_URL not configured, skipping webhook')
    return { skipped: true, reason: 'Webhook URL not configured' }
  }
  
  try {
    const webhookPayload = {
      event: 'business.provisioned',
      timestamp: new Date().toISOString(),
      business: {
        businessId: businessData.businessId,
        name: businessData.name,
        ownerEmail: businessData.ownerEmail,
        ownerUserId: businessData.ownerUserId,
        status: businessData.status
      },
      opsRequestId: businessData.ops?.lastRequestId,
      result: opsResult?.result || opsResult
    }
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      console.warn(`[business/confirm] n8n webhook returned ${response.status}`)
      return { triggered: true, success: false, status: response.status }
    }
    
    console.log('[business/confirm] n8n webhook triggered successfully')
    return { triggered: true, success: true }
    
  } catch (error) {
    console.error('[business/confirm] n8n webhook failed:', error.message)
    return { triggered: true, success: false, error: error.message }
  }
}

function checkToolRequiresApproval(toolName) {
  const tool = toolRegistry.getTool(toolName)
  return tool?.requiresApproval === true
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
    
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    
    const { businessId } = body
    
    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: 'businessId is required' },
        { status: 400 }
      )
    }
    
    const collection = database.collection(COLLECTION_NAME)
    const business = await collection.findOne({ businessId })
    
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found. Please register first.' },
        { status: 404 }
      )
    }
    
    if (business.ownerUserId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }
    
    if (business.status === BUSINESS_STATUS.READY) {
      return NextResponse.json({
        ok: true,
        businessId,
        status: business.status,
        message: 'Business already provisioned',
        alreadyProvisioned: true
      })
    }
    
    if (business.status === BUSINESS_STATUS.PROVISIONING) {
      return NextResponse.json({
        ok: false,
        error: 'Provisioning already in progress',
        businessId,
        status: business.status,
        opsRequestId: business.ops?.lastRequestId
      }, { status: 409 })
    }
    
    if (business.ops?.approvalRequestId && business.ops?.lastRequestStatus === 'pending_approval') {
      return NextResponse.json({
        ok: false,
        error: 'Approval pending',
        businessId,
        status: business.status,
        approvalRequestId: business.ops.approvalRequestId,
        message: 'This operation requires approval. Please wait for approval or contact an admin.'
      }, { status: 202 })
    }
    
    const requestId = generateRequestId()
    const toolName = 'tenant.bootstrap'
    const requiresApproval = checkToolRequiresApproval(toolName)
    
    await collection.updateOne(
      { businessId },
      { 
        $set: { 
          status: BUSINESS_STATUS.PROVISIONING,
          statusReason: requiresApproval ? 'Awaiting approval' : 'Provisioning in progress',
          updatedAt: new Date()
        }
      }
    )
    
    const opsPayload = {
      businessId,
      name: business.name,
      skipVoiceTest: business.provisioningOptions?.skipVoiceTest || false,
      skipBillingCheck: business.provisioningOptions?.skipBillingCheck || false
    }
    
    if (requiresApproval) {
      console.log(`[business/confirm] Tool ${toolName} requires approval, creating request`)
      
      const { data, ok } = await callOpsControlPlane('/requests', {
        tool: toolName,
        payload: opsPayload,
        meta: {
          requestId,
          reason: `Business provisioning for ${business.name} (${businessId})`,
          requestedBy: userEmail
        }
      })
      
      if (!ok || !data.ok) {
        await collection.updateOne(
          { businessId },
          { 
            $set: { 
              status: BUSINESS_STATUS.PENDING,
              statusReason: 'Approval request failed',
              ops: updateBusinessOps(business, {
                requestId,
                requestType: 'approval',
                status: 'failed',
                error: data.error || 'Failed to create approval request'
              }),
              updatedAt: new Date()
            }
          }
        )
        
        return NextResponse.json({
          ok: false,
          error: 'Failed to create approval request',
          details: data.error
        }, { status: 500 })
      }
      
      const approvalRequestId = data.requestId
      
      await collection.updateOne(
        { businessId },
        { 
          $set: { 
            status: BUSINESS_STATUS.PENDING,
            statusReason: 'Awaiting admin approval',
            ops: updateBusinessOps(business, {
              requestId,
              requestType: 'approval',
              status: 'pending_approval',
              result: data,
              approvalRequestId
            }),
            updatedAt: new Date()
          }
        }
      )
      
      return NextResponse.json({
        ok: true,
        businessId,
        status: 'pending_approval',
        requiresApproval: true,
        approvalRequestId,
        message: 'Provisioning requires approval. An admin will review your request.',
        _meta: { durationMs: Date.now() - startTime }
      })
    }
    
    // Execute directly
    console.log(`[business/confirm] Executing ${toolName} directly`)
    
    const { data: opsResult, ok } = await callOpsControlPlane('/execute', {
      tool: toolName,
      payload: opsPayload,
      meta: {
        requestId,
        mode: 'execute',
        dryRun: false
      }
    })
    
    const provisioningSuccess = ok && opsResult.ok
    const newStatus = provisioningSuccess ? BUSINESS_STATUS.READY : BUSINESS_STATUS.FAILED
    const newStatusReason = provisioningSuccess
      ? 'Business provisioned successfully'
      : opsResult.error?.message || 'Provisioning failed'
    
    const updatedOps = updateBusinessOps(business, {
      requestId,
      requestType: 'execute',
      status: provisioningSuccess ? 'success' : 'failed',
      result: opsResult.result,
      error: provisioningSuccess ? null : opsResult.error
    })
    
    const features = {
      voiceEnabled: opsResult.result?.checks?.some(c => c.item === 'voice_ready' && c.status === 'passed') || false,
      billingEnabled: opsResult.result?.checks?.some(c => c.item === 'stripe_configured' && c.status === 'passed') || false,
      agentEnabled: provisioningSuccess
    }
    
    await collection.updateOne(
      { businessId },
      { 
        $set: { 
          status: newStatus,
          statusReason: newStatusReason,
          ops: updatedOps,
          features,
          updatedAt: new Date()
        }
      }
    )
    
    let webhookResult = null
    if (provisioningSuccess) {
      const updatedBusiness = await collection.findOne({ businessId })
      webhookResult = await triggerN8nWebhook(updatedBusiness, opsResult)
    }
    
    const durationMs = Date.now() - startTime
    
    return NextResponse.json({
      ok: provisioningSuccess,
      businessId,
      name: business.name,
      status: newStatus,
      statusReason: newStatusReason,
      requestId,
      result: opsResult.result,
      features,
      webhook: webhookResult,
      message: provisioningSuccess 
        ? 'Business provisioned successfully!' 
        : 'Provisioning failed. Please try again or contact support.',
      _meta: { durationMs }
    }, { status: provisioningSuccess ? 200 : 500 })
    
  } catch (error) {
    console.error('[business/confirm] Error:', error)
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
