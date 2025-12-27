/**
 * Tool: billing.validateStripeConfig
 * 
 * Validates Stripe configuration and price IDs.
 */

import { z } from 'zod'
import { env } from '@/lib/env'
import { getStripe } from '@/lib/stripeSubscription'

export const name = 'billing.validateStripeConfig'

export const description = 'Validate Stripe configuration and price IDs'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required')
})

/**
 * Validate a single price in Stripe
 * @param {Stripe} stripe - Stripe client
 * @param {string} priceId - Price ID to validate
 * @param {string} label - Label for this price
 * @returns {Promise<object>}
 */
async function validatePrice(stripe, priceId, label) {
  if (!priceId) {
    return {
      label,
      priceId: null,
      valid: false,
      error: 'Price ID not configured in environment'
    }
  }
  
  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product']
    })
    
    return {
      label,
      priceId: price.id,
      valid: true,
      active: price.active,
      currency: price.currency,
      unitAmount: price.unit_amount,
      productId: typeof price.product === 'object' ? price.product.id : price.product,
      productName: typeof price.product === 'object' ? price.product.name : null,
      recurring: price.recurring ? {
        interval: price.recurring.interval,
        usageType: price.recurring.usage_type
      } : null
    }
  } catch (error) {
    return {
      label,
      priceId,
      valid: false,
      error: error.message
    }
  }
}

/**
 * Execute billing.validateStripeConfig
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId } = args
  const { requestId } = ctx
  
  console.log(`[ops:${requestId}] billing.validateStripeConfig: Validating for business ${businessId}`)
  
  const checks = []
  const issues = []
  
  // Check environment configuration
  const hasSecretKey = !!env.STRIPE?.SECRET_KEY
  const hasPublishableKey = !!env.STRIPE?.PUBLISHABLE_KEY
  const hasWebhookSecret = !!env.STRIPE?.WEBHOOK_SECRET
  const stripeConfigured = hasSecretKey && hasPublishableKey && hasWebhookSecret
  
  checks.push({
    name: 'stripe_secret_key',
    ok: hasSecretKey,
    message: hasSecretKey ? 'Secret key configured' : 'Secret key missing'
  })
  
  checks.push({
    name: 'stripe_publishable_key',
    ok: hasPublishableKey,
    message: hasPublishableKey ? 'Publishable key configured' : 'Publishable key missing'
  })
  
  checks.push({
    name: 'stripe_webhook_secret',
    ok: hasWebhookSecret,
    message: hasWebhookSecret ? 'Webhook secret configured' : 'Webhook secret missing'
  })
  
  if (!stripeConfigured) {
    issues.push('Stripe is not fully configured. Check environment variables.')
    return {
      ok: false,
      businessId,
      stripeConfigured: false,
      stripeMode: 'unknown',
      checks,
      issues,
      prices: null,
      summary: 'Stripe configuration incomplete'
    }
  }
  
  // Determine Stripe mode
  let stripeMode = 'unknown'
  const secretKey = env.STRIPE?.SECRET_KEY || ''
  if (secretKey.startsWith('sk_test_')) {
    stripeMode = 'test'
  } else if (secretKey.startsWith('sk_live_')) {
    stripeMode = 'live'
  }
  
  checks.push({
    name: 'stripe_mode',
    ok: stripeMode !== 'unknown',
    message: `Stripe mode: ${stripeMode}`
  })
  
  // Validate price IDs
  const stripe = await getStripe()
  if (!stripe) {
    issues.push('Failed to initialize Stripe client')
    return {
      ok: false,
      businessId,
      stripeConfigured: true,
      stripeMode,
      checks,
      issues,
      prices: null,
      summary: 'Failed to initialize Stripe client'
    }
  }
  
  const priceValidations = await Promise.all([
    validatePrice(stripe, env.STRIPE?.PRICE_STARTER, 'starter'),
    validatePrice(stripe, env.STRIPE?.PRICE_GROWTH, 'growth'),
    validatePrice(stripe, env.STRIPE?.PRICE_ENTERPRISE, 'enterprise'),
    validatePrice(stripe, env.STRIPE?.PRICE_CALL_MINUTE_METERED, 'callMinuteMetered')
  ])
  
  const prices = {}
  for (const validation of priceValidations) {
    prices[validation.label] = validation
    
    checks.push({
      name: `price_${validation.label}`,
      ok: validation.valid && validation.active !== false,
      message: validation.valid 
        ? (validation.active ? `${validation.label} price valid and active` : `${validation.label} price exists but inactive`)
        : `${validation.label} price invalid: ${validation.error}`
    })
    
    if (!validation.valid) {
      issues.push(`${validation.label}: ${validation.error}`)
    } else if (!validation.active) {
      issues.push(`${validation.label}: Price exists but is not active`)
    }
  }
  
  const allPricesValid = priceValidations.every(p => p.valid && p.active !== false)
  
  console.log(`[ops:${requestId}] billing.validateStripeConfig: Complete. Issues: ${issues.length}`)
  
  return {
    ok: issues.length === 0,
    businessId,
    stripeConfigured: true,
    stripeMode,
    checks,
    issues: issues.length > 0 ? issues : null,
    prices,
    allPricesValid,
    summary: issues.length === 0 
      ? 'Stripe configuration valid' 
      : `Found ${issues.length} issue(s)`
  }
}
