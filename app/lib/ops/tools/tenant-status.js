/**
 * Tool: tenant.status
 * 
 * Read-only tenant status check - returns comprehensive status without mutation.
 * Calls shared internal functions directly (not HTTP).
 * 
 * Category: tenant
 * Risk: low
 * Mutates: false
 * Requires Approval: false
 */

import { z } from 'zod'
import { isSubscribed } from '@/lib/subscription'

export const name = 'tenant.status'

export const description = 'Read-only tenant status check - returns comprehensive status without mutation'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required')
})

/**
 * Execute tenant.status
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId } = args
  const { db, requestId } = ctx
  
  console.log(`[ops:${requestId}] tenant.status: Checking status for business ${businessId}`)
  
  const checks = []
  const recommendations = []
  
  // 1. Check if business exists
  const usersCollection = db.collection('users')
  const user = await usersCollection.findOne({ id: businessId })
  
  if (!user) {
    checks.push({
      item: 'business_exists',
      status: 'failed',
      details: `Business '${businessId}' not found in database`
    })
    
    return {
      ok: true,
      businessId,
      summary: {
        ready: false,
        readyMessage: 'Business not found'
      },
      checks,
      recommendations: ['Create the business using tenant.bootstrap']
    }
  }
  
  checks.push({
    item: 'business_exists',
    status: 'passed',
    details: `Found business: ${user.email || businessId}`
  })
  
  // 2. Check subscription status
  const subscription = user.subscription || {}
  const subscriptionActive = isSubscribed(user)
  
  if (subscriptionActive) {
    checks.push({
      item: 'subscription_active',
      status: 'passed',
      details: `Status: ${subscription.status}, Plan: ${subscription.stripePriceId || 'unknown'}`
    })
  } else {
    checks.push({
      item: 'subscription_active',
      status: 'warning',
      details: `Status: ${subscription.status || 'none'}`
    })
    recommendations.push('Activate subscription via billing portal')
  }
  
  // 3. Check Stripe configuration
  const hasStripeCustomer = !!subscription.stripeCustomerId
  const hasStripeSubscription = !!subscription.stripeSubscriptionId
  const hasCallMinutesItem = !!subscription.stripeCallMinutesItemId
  
  if (hasStripeCustomer && hasStripeSubscription) {
    checks.push({
      item: 'stripe_integration',
      status: 'passed',
      details: 'Stripe customer and subscription configured'
    })
  } else {
    checks.push({
      item: 'stripe_integration',
      status: hasStripeCustomer ? 'warning' : 'failed',
      details: `Customer: ${hasStripeCustomer ? 'yes' : 'no'}, Subscription: ${hasStripeSubscription ? 'yes' : 'no'}`
    })
    if (!hasStripeCustomer) {
      recommendations.push('Set up Stripe customer via checkout')
    }
  }
  
  if (!hasCallMinutesItem && subscriptionActive) {
    checks.push({
      item: 'call_minutes_metering',
      status: 'warning',
      details: 'Call minutes metering not configured'
    })
    recommendations.push('Configure call minutes metering item')
  } else if (hasCallMinutesItem) {
    checks.push({
      item: 'call_minutes_metering',
      status: 'passed',
      details: 'Call minutes metering configured'
    })
  }
  
  // 4. Check calendar connection
  const google = user.google || {}
  const calendarConnected = !!(google.refreshToken || google.connected)
  const selectedCalendars = google.selectedCalendarIds || []
  
  if (calendarConnected) {
    checks.push({
      item: 'calendar_connected',
      status: 'passed',
      details: `${selectedCalendars.length} calendar(s) selected`
    })
  } else {
    checks.push({
      item: 'calendar_connected',
      status: 'warning',
      details: 'Google Calendar not connected'
    })
    recommendations.push('Connect Google Calendar for scheduling')
  }
  
  // 5. Check scheduling configuration
  const scheduling = user.scheduling || {}
  const hasHandle = !!scheduling.handle
  const hasAvailability = !!(scheduling.availability && Object.keys(scheduling.availability).length > 0)
  
  if (hasHandle && hasAvailability) {
    checks.push({
      item: 'scheduling_configured',
      status: 'passed',
      details: `Handle: ${scheduling.handle}, Availability: configured`
    })
  } else {
    checks.push({
      item: 'scheduling_configured',
      status: 'warning',
      details: `Handle: ${hasHandle ? scheduling.handle : 'not set'}, Availability: ${hasAvailability ? 'set' : 'not set'}`
    })
    if (!hasHandle) recommendations.push('Set scheduling handle')
    if (!hasAvailability) recommendations.push('Configure availability hours')
  }
  
  // 6. Check voice agents
  const phoneAgents = user.phoneAgents || []
  const voiceAgentCount = phoneAgents.length
  
  if (voiceAgentCount > 0) {
    checks.push({
      item: 'voice_agents',
      status: 'passed',
      details: `${voiceAgentCount} voice agent(s) configured`
    })
  } else {
    checks.push({
      item: 'voice_agents',
      status: 'info',
      details: 'No voice agents configured (optional)'
    })
  }
  
  // 7. Check event types
  const eventTypesCollection = db.collection('event_types')
  const eventTypeCount = await eventTypesCollection.countDocuments({ userId: businessId })
  
  if (eventTypeCount > 0) {
    checks.push({
      item: 'event_types',
      status: 'passed',
      details: `${eventTypeCount} event type(s) created`
    })
  } else {
    checks.push({
      item: 'event_types',
      status: 'warning',
      details: 'No event types created'
    })
    recommendations.push('Create at least one event type')
  }
  
  // Calculate readiness
  const passedChecks = checks.filter(c => c.status === 'passed').length
  const failedChecks = checks.filter(c => c.status === 'failed').length
  const totalChecks = checks.length
  
  // Tenant is ready if no failed checks and key items pass
  const isReady = failedChecks === 0 && subscriptionActive && hasStripeCustomer
  
  const readyMessage = isReady 
    ? `Tenant fully operational (${passedChecks}/${totalChecks} checks passed)`
    : failedChecks > 0 
      ? `${failedChecks} critical issue(s) found`
      : 'Tenant needs configuration'
  
  console.log(`[ops:${requestId}] tenant.status: ${readyMessage}`)
  
  return {
    ok: true,
    businessId,
    summary: {
      ready: isReady,
      readyMessage
    },
    checks,
    recommendations: recommendations.length > 0 ? recommendations : undefined
  }
}
