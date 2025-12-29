/**
 * Tool: tenant.ensure
 * 
 * Ensures a tenant/business exists in the system.
 * Creates a minimal record if it doesn't exist.
 */

import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

export const name = 'tenant.ensure'

export const description = 'Ensure a tenant/business exists in the system'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required')
})

/**
 * Execute tenant.ensure
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId } = args
  const { db, dryRun, requestId } = ctx
  
  console.log(`[ops:${requestId}] tenant.ensure: Checking business ${businessId}`)
  
  // Check if business/user exists
  const usersCollection = db.collection('users')
  const existingUser = await usersCollection.findOne({ id: businessId })
  
  if (existingUser) {
    console.log(`[ops:${requestId}] tenant.ensure: Business ${businessId} already exists`)
    return {
      ok: true,
      businessId,
      existed: true,
      created: false,
      summary: `Business ${businessId} already exists`
    }
  }
  
  // In dry run mode, don't create
  if (dryRun) {
    console.log(`[ops:${requestId}] tenant.ensure: [DRY RUN] Would create business ${businessId}`)
    return {
      ok: true,
      businessId,
      existed: false,
      created: false,
      dryRunPlan: {
        action: 'create_business',
        businessId,
        fields: ['id', 'email', 'createdAt', 'subscription']
      },
      summary: `[DRY RUN] Would create business ${businessId}`
    }
  }
  
  // Create minimal business record
  const newBusiness = {
    id: businessId,
    email: `${businessId}@placeholder.book8.ai`,
    name: `Business ${businessId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subscription: {},
    scheduling: {},
    createdByOps: true,
    opsRequestId: requestId
  }
  
  await usersCollection.insertOne(newBusiness)
  
  console.log(`[ops:${requestId}] tenant.ensure: Created business ${businessId}`)
  
  return {
    ok: true,
    businessId,
    existed: false,
    created: true,
    summary: `Created business ${businessId}`
  }
}
