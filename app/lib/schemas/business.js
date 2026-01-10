/**
 * Business Schema
 * 
 * Represents a business/tenant in the book8 system.
 * Supports multi-business per user.
 * 
 * Collection: businesses
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * Business status values
 */
export const BUSINESS_STATUS = {
  PENDING: 'pending',           // Created but not provisioned
  PROVISIONING: 'provisioning', // Provisioning in progress
  READY: 'ready',               // Fully operational
  NEEDS_ATTENTION: 'needs_attention', // Has issues that need resolution
  FAILED: 'failed'              // Provisioning failed
}

/**
 * Subscription status values
 */
export const SUBSCRIPTION_STATUS = {
  NONE: 'none',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  UNPAID: 'unpaid'
}

/**
 * Generate a unique business ID
 */
export function generateBusinessId(prefix = 'biz') {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}${random}`
}

/**
 * Create a new business document
 */
export function createBusiness({
  businessId,
  name,
  ownerUserId,
  ownerEmail,
  skipVoiceTest = false,
  skipBillingCheck = false
}) {
  const now = new Date()
  
  return {
    // Core identity
    businessId: businessId || generateBusinessId(),
    name: name || 'Untitled Business',
    
    // Ownership
    ownerUserId,
    ownerEmail,
    
    // Status
    status: BUSINESS_STATUS.PENDING,
    statusReason: 'Business created, awaiting provisioning',
    
    // Subscription (populated after Stripe setup)
    subscription: {
      status: SUBSCRIPTION_STATUS.NONE,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null
    },
    
    // Calendar connection
    calendar: {
      connected: false,
      provider: null, // 'google' | 'outlook' | etc.
      calendarId: null,
      lastSyncedAt: null
    },
    
    // Provisioning options (persisted)
    provisioningOptions: {
      skipVoiceTest,
      skipBillingCheck
    },
    
    // Ops Control Plane tracking
    ops: {
      lastRequestId: null,
      lastRequestType: null, // 'plan' | 'execute' | 'approval'
      lastRequestStatus: null, // 'pending' | 'success' | 'failed'
      lastRequestAt: null,
      lastResult: null,
      lastError: null,
      approvalRequestId: null, // If requiresApproval, track the approval request
      provisionedAt: null
    },
    
    // Feature flags
    features: {
      voiceEnabled: false,
      billingEnabled: false,
      agentEnabled: false
    },
    
    // Timestamps
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Update business ops tracking
 */
export function updateBusinessOps(business, {
  requestId,
  requestType,
  status,
  result = null,
  error = null,
  approvalRequestId = null
}) {
  return {
    ...business.ops,
    lastRequestId: requestId,
    lastRequestType: requestType,
    lastRequestStatus: status,
    lastRequestAt: new Date(),
    lastResult: result,
    lastError: error,
    approvalRequestId: approvalRequestId || business.ops?.approvalRequestId,
    provisionedAt: status === 'success' && requestType === 'execute' 
      ? new Date() 
      : business.ops?.provisionedAt
  }
}

/**
 * Validate business input
 */
export function validateBusinessInput(input) {
  const errors = []
  
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length < 2) {
    errors.push('Business name must be at least 2 characters')
  }
  
  if (input.name && input.name.length > 100) {
    errors.push('Business name must be less than 100 characters')
  }
  
  if (input.businessId) {
    if (typeof input.businessId !== 'string') {
      errors.push('Business ID must be a string')
    } else if (!/^[a-zA-Z0-9_-]+$/.test(input.businessId)) {
      errors.push('Business ID can only contain letters, numbers, underscores, and hyphens')
    } else if (input.businessId.length < 3 || input.businessId.length > 50) {
      errors.push('Business ID must be between 3 and 50 characters')
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Database indexes for businesses collection
 */
export const BUSINESS_INDEXES = [
  { key: { businessId: 1 }, unique: true },
  { key: { ownerUserId: 1 } },
  { key: { ownerEmail: 1 } },
  { key: { status: 1 } },
  { key: { 'subscription.status': 1 } },
  { key: { createdAt: -1 } }
]

/**
 * Collection name
 */
export const COLLECTION_NAME = 'businesses'
