/**
 * Tool: billing.syncPrices
 * 
 * Sync/manage Stripe prices for a tenant. Supports plan mode for preview.
 * 
 * Category: billing
 * Risk: medium
 * Mutates: true (in execute mode)
 * Requires Approval: true
 * Supports Plan Mode: true
 */

import { z } from 'zod'
import { env } from '@/lib/env'
import Stripe from 'stripe'
import { redactSensitiveData } from '../audit.js'

export const name = 'billing.syncPrices'

export const description = 'Sync Stripe prices for a tenant - supports plan mode for preview, requires approval for execution'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required'),
  mode: z.enum(['plan', 'execute']).default('plan').describe('plan = preview changes, execute = apply changes'),
  currency: z.string().length(3).default('usd').describe('Currency code (lowercase)'),
  priceMap: z.record(z.string(), z.object({
    unitAmount: z.number().int().positive().describe('Amount in cents'),
    nickname: z.string().optional(),
    recurring: z.object({
      interval: z.enum(['day', 'week', 'month', 'year']),
      intervalCount: z.number().int().positive().default(1)
    }).optional(),
    metadata: z.record(z.string(), z.string()).optional()
  })).optional().describe('Map of price key to price config. If not provided, syncs from environment defaults.')
})

// Default price configuration from environment
function getDefaultPriceConfig() {
  return {
    'starter': {
      unitAmount: 2900, // $29
      nickname: 'Starter Plan',
      recurring: { interval: 'month', intervalCount: 1 },
      metadata: { tier: 'starter', features: 'basic' }
    },
    'professional': {
      unitAmount: 7900, // $79
      nickname: 'Professional Plan',
      recurring: { interval: 'month', intervalCount: 1 },
      metadata: { tier: 'professional', features: 'advanced' }
    },
    'enterprise': {
      unitAmount: 19900, // $199
      nickname: 'Enterprise Plan',
      recurring: { interval: 'month', intervalCount: 1 },
      metadata: { tier: 'enterprise', features: 'all' }
    },
    'call_minutes': {
      unitAmount: 15, // $0.15 per minute
      nickname: 'Call Minutes (per minute)',
      metadata: { type: 'metered', unit: 'minute' }
    }
  }
}

/**
 * Get existing Stripe prices for comparison
 */
async function getExistingPrices(stripe, productId) {
  try {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100
    })
    return prices.data
  } catch (error) {
    if (error.code === 'resource_missing') {
      return []
    }
    throw error
  }
}

/**
 * Compare desired price with existing price
 */
function comparePrices(desired, existing) {
  if (!existing) return 'create'
  
  // Check if key fields match
  const unitAmountMatch = existing.unit_amount === desired.unitAmount
  const currencyMatch = existing.currency === desired.currency
  const recurringMatch = !desired.recurring || (
    existing.recurring &&
    existing.recurring.interval === desired.recurring.interval &&
    existing.recurring.interval_count === desired.recurring.intervalCount
  )
  
  if (unitAmountMatch && currencyMatch && recurringMatch) {
    return 'noop'
  }
  
  return 'update'
}

/**
 * Execute billing.syncPrices
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId, mode = 'plan', currency = 'usd', priceMap } = args
  const { db, requestId, dryRun } = ctx
  
  console.log(`[ops:${requestId}] billing.syncPrices: ${mode} mode for ${businessId}`)
  
  // Validate Stripe configuration
  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      businessId,
      error: {
        code: 'STRIPE_NOT_CONFIGURED',
        message: 'STRIPE_SECRET_KEY not configured'
      }
    }
  }
  
  // Initialize Stripe (redact key in logs)
  const stripeKeyRedacted = redactSensitiveData({ key: env.STRIPE_SECRET_KEY }).key
  console.log(`[ops:${requestId}] billing.syncPrices: Using Stripe key ${stripeKeyRedacted}`)
  
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  
  // Get or use default price configuration
  const pricesToSync = priceMap || getDefaultPriceConfig()
  
  // Get the product ID from env or create one
  const productId = env.STRIPE_PRODUCT_ID || 'prod_book8_default'
  
  // Build the plan
  const plan = []
  const actions = { create: [], update: [], noop: [] }
  
  try {
    // Get existing prices
    let existingPrices = []
    try {
      existingPrices = await getExistingPrices(stripe, productId)
    } catch {
      // Product might not exist yet
    }
    
    // Build price lookup by nickname/metadata
    const existingByKey = {}
    for (const price of existingPrices) {
      const key = price.nickname || price.metadata?.key || price.id
      existingByKey[key] = price
    }
    
    // Analyze each price
    for (const [key, config] of Object.entries(pricesToSync)) {
      const existing = existingByKey[key] || existingByKey[config.nickname]
      const action = comparePrices({ ...config, currency }, existing)
      
      const planItem = {
        key,
        action,
        desired: {
          unitAmount: config.unitAmount,
          currency,
          nickname: config.nickname || key,
          recurring: config.recurring,
          metadata: config.metadata
        },
        existing: existing ? {
          id: existing.id,
          unitAmount: existing.unit_amount,
          currency: existing.currency,
          nickname: existing.nickname
        } : null
      }
      
      plan.push(planItem)
      actions[action].push(key)
    }
    
    // If plan mode, return the plan without executing
    if (mode === 'plan' || dryRun) {
      console.log(`[ops:${requestId}] billing.syncPrices: Plan generated - ${actions.create.length} create, ${actions.update.length} update, ${actions.noop.length} noop`)
      
      return {
        ok: true,
        businessId,
        mode: 'plan',
        executed: false,
        plan,
        summary: {
          toCreate: actions.create.length,
          toUpdate: actions.update.length,
          noChange: actions.noop.length,
          total: plan.length
        },
        nextStep: actions.create.length + actions.update.length > 0
          ? 'Submit with mode="execute" to apply changes (requires approval)'
          : 'No changes needed'
      }
    }
    
    // Execute mode - apply changes
    console.log(`[ops:${requestId}] billing.syncPrices: Executing ${actions.create.length} creates, ${actions.update.length} updates`)
    
    const results = {
      created: [],
      updated: [],
      noop: actions.noop,
      errors: []
    }
    
    // Ensure product exists
    try {
      await stripe.products.retrieve(productId)
    } catch (error) {
      if (error.code === 'resource_missing') {
        await stripe.products.create({
          id: productId,
          name: 'Book8 Services',
          description: 'Book8 subscription and usage-based services'
        })
        console.log(`[ops:${requestId}] billing.syncPrices: Created product ${productId}`)
      } else {
        throw error
      }
    }
    
    // Process each price that needs action
    for (const item of plan) {
      if (item.action === 'noop') continue
      
      try {
        if (item.action === 'create') {
          const priceData = {
            product: productId,
            unit_amount: item.desired.unitAmount,
            currency: item.desired.currency,
            nickname: item.desired.nickname,
            metadata: { ...item.desired.metadata, key: item.key }
          }
          
          if (item.desired.recurring) {
            priceData.recurring = {
              interval: item.desired.recurring.interval,
              interval_count: item.desired.recurring.intervalCount
            }
          }
          
          const newPrice = await stripe.prices.create(priceData)
          results.created.push({ key: item.key, priceId: newPrice.id })
          console.log(`[ops:${requestId}] billing.syncPrices: Created price ${newPrice.id} for ${item.key}`)
          
        } else if (item.action === 'update') {
          // Stripe doesn't allow updating prices, so we archive old and create new
          if (item.existing?.id) {
            await stripe.prices.update(item.existing.id, { active: false })
          }
          
          const priceData = {
            product: productId,
            unit_amount: item.desired.unitAmount,
            currency: item.desired.currency,
            nickname: item.desired.nickname,
            metadata: { ...item.desired.metadata, key: item.key }
          }
          
          if (item.desired.recurring) {
            priceData.recurring = {
              interval: item.desired.recurring.interval,
              interval_count: item.desired.recurring.intervalCount
            }
          }
          
          const newPrice = await stripe.prices.create(priceData)
          results.updated.push({ 
            key: item.key, 
            oldPriceId: item.existing?.id, 
            newPriceId: newPrice.id 
          })
          console.log(`[ops:${requestId}] billing.syncPrices: Updated price for ${item.key}: ${item.existing?.id} -> ${newPrice.id}`)
        }
      } catch (error) {
        results.errors.push({
          key: item.key,
          action: item.action,
          error: error.message
        })
        console.error(`[ops:${requestId}] billing.syncPrices: Error processing ${item.key}: ${error.message}`)
      }
    }
    
    const success = results.errors.length === 0
    
    return {
      ok: success,
      businessId,
      mode: 'execute',
      executed: true,
      plan,
      created: results.created,
      updated: results.updated,
      noop: results.noop,
      errors: results.errors.length > 0 ? results.errors : undefined,
      summary: {
        created: results.created.length,
        updated: results.updated.length,
        noChange: results.noop.length,
        errors: results.errors.length
      }
    }
    
  } catch (error) {
    console.error(`[ops:${requestId}] billing.syncPrices: Error - ${error.message}`)
    
    return {
      ok: false,
      businessId,
      mode,
      executed: false,
      error: {
        code: 'STRIPE_ERROR',
        message: error.message,
        type: error.type
      }
    }
  }
}
