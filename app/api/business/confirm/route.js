/**
 * POST /api/business/confirm
 * 
 * Confirm and execute business provisioning.
 * 
 * This endpoint:
 * 1. Validates the business exists and is in pending/failed state
 * 2. Checks if tool requires approval (policy-aware)
 * 3. If requiresApproval: creates approval request
 * 4. If not: executes tenant.bootstrap directly
 * 5. Updates business status
 * 6. Triggers n8n webhook on success (if configured)
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { 
  updateBusinessOps,
  BUSINESS_STATUS,
  COLLECTION_NAME 
} from '@/lib/schemas/business'
import toolRegistry from '@/lib/ops/tool-registry'

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
async function callOpsControlPlane(endpoint, payload, options = {}) {
  const baseUrl = env.BASE_URL || 'http://localhost:3000'
  const secret = env.OPS_INTERNAL_SECRET
  
  if (!secret) {
    throw new Error('OPS_INTERNAL_SECRET not configured')
  }
  
  const url = `${baseUrl}/api/internal/ops${endpoint}`
  
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-book8-internal-secret': secret,
      'x-book8-caller': 'book8_app'
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  })
  
  const data = await response.json()
  
  return { response, data, ok: response.ok }
}

/**
 * Call n8n webhook (if configured)
 */
async function triggerN8nWebhook(businessData, opsResult) {
  // Get webhook URL from env (skip if not configured)
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload),
      // Short timeout - webhook should not block user flow
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      console.warn(`[business/confirm] n8n webhook returned ${response.status}`)
      return { 
        triggered: true, 
        success: false, 
        status: response.status 
      }
    }
    
    console.log('[business/confirm] n8n webhook triggered successfully')
    return { triggered: true, success: true }
    
  } catch (error) {
    console.error('[business/confirm] n8n webhook failed:', error.message)
    // Don't fail the request if webhook fails
    return { 
      triggered: true, 
      success: false, 
      error: error.message 
    }
  }
}

/**
 * Check if tool requires approval
 */
function checkToolRequiresApproval(toolName) {
  const tool = toolRegistry.getTool(toolName)
  return tool?.requiresApproval === true
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
    
    // 2. Parse input
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
    
    // 3. Get database and find business
    const db = await getDb()
    const collection = db.collection(COLLECTION_NAME)
    
    const business = await collection.findOne({ businessId })
    
    if (!business) {
      return NextResponse.json(
        { ok: false, error: 'Business not found. Please register first.' },
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
    
    // 4. Check business status
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
    
    // 5. Check if approval is pending
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
    
    // 6. Generate request ID
    const requestId = generateRequestId()
    
    // 7. Check if tool requires approval
    const toolName = 'tenant.bootstrap'
    const requiresApproval = checkToolRequiresApproval(toolName)
    
    // 8. Update status to provisioning
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
    
    // 9. Either create approval request or execute directly
    let opsResult
    let approvalRequestId = null
    
    const opsPayload = {
      businessId,
      name: business.name,
      skipVoiceTest: business.provisioningOptions?.skipVoiceTest || false,
      skipBillingCheck: business.provisioningOptions?.skipBillingCheck || false
    }
    
    if (requiresApproval) {
      // Create approval request
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
        // Revert status
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
      
      approvalRequestId = data.requestId
      
      // Update business with approval tracking
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
        _meta: {
          durationMs: Date.now() - startTime
        }
      })
    }
    
    // Execute directly (no approval required)
    console.log(`[business/confirm] Executing ${toolName} directly`)
    
    const { data, ok } = await callOpsControlPlane('/execute', {
      tool: toolName,
      payload: opsPayload,
      meta: {
        requestId,
        mode: 'execute',
        dryRun: false
      }
    })
    
    opsResult = data
    
    // 10. Process result
    const provisioningSuccess = ok && opsResult.ok
    
    const newStatus = provisioningSuccess 
      ? BUSINESS_STATUS.READY 
      : BUSINESS_STATUS.FAILED
    
    const newStatusReason = provisioningSuccess
      ? 'Business provisioned successfully'
      : opsResult.error?.message || 'Provisioning failed'
    
    // Update business record
    const updatedOps = updateBusinessOps(business, {
      requestId,
      requestType: 'execute',
      status: provisioningSuccess ? 'success' : 'failed',
      result: opsResult.result,
      error: provisioningSuccess ? null : opsResult.error
    })
    
    // Extract features from result
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
    
    // 11. Trigger n8n webhook on success
    let webhookResult = null
    if (provisioningSuccess) {
      const updatedBusiness = await collection.findOne({ businessId })
      webhookResult = await triggerN8nWebhook(updatedBusiness, opsResult)
    }
    
    const durationMs = Date.now() - startTime
    
    // 12. Return result
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
      _meta: {
        durationMs
      }
    }, { status: provisioningSuccess ? 200 : 500 })
    
  } catch (error) {
    console.error('[business/confirm] Error:', error)
    
    return NextResponse.json({
      ok: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
