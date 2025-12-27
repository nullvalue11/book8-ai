/**
 * Tool: tenant.provisioningSummary
 * 
 * Read-only summary of tenant provisioning state.
 */

import { z } from 'zod'
import { isSubscribed } from '@/lib/subscription'

export const name = 'tenant.provisioningSummary'

export const description = 'Get provisioning summary for a tenant'

export const schema = z.object({
  businessId: z.string().min(1, 'businessId is required')
})

/**
 * Execute tenant.provisioningSummary
 * @param {object} args - Validated arguments
 * @param {object} ctx - Execution context
 * @returns {Promise<object>} Result
 */
export async function execute(args, ctx) {
  const { businessId } = args
  const { db, requestId } = ctx
  
  console.log(`[ops:${requestId}] tenant.provisioningSummary: Fetching for business ${businessId}`)
  
  // Find the business/user
  const usersCollection = db.collection('users')
  const user = await usersCollection.findOne({ id: businessId })
  
  if (!user) {
    return {
      ok: false,
      businessId,
      exists: false,
      summary: 'Business not found',
      error: {
        code: 'BUSINESS_NOT_FOUND',
        message: `No business found with ID: ${businessId}`
      }
    }
  }
  
  // Extract subscription info
  const subscription = user.subscription || {}
  const subscriptionActive = isSubscribed(user)
  
  // Determine plan tier
  let planTier = null
  const stripePriceId = subscription.stripePriceId
  if (stripePriceId) {
    // We can't directly access env here, so we'll just show the price ID
    planTier = stripePriceId
  }
  
  // Check voice config
  const phoneAgents = user.phoneAgents || []
  const hasVoiceConfig = phoneAgents.length > 0
  const voiceAgentCount = phoneAgents.length
  
  // Check calendar connection
  const google = user.google || {}
  const calendarConnected = !!(google.refreshToken || google.connected)
  const selectedCalendars = google.selectedCalendarIds || []
  
  // Check scheduling config
  const scheduling = user.scheduling || {}
  const hasHandle = !!scheduling.handle
  const hasAvailability = !!(scheduling.availability && Object.keys(scheduling.availability).length > 0)
  
  // Check event types
  const eventTypesCollection = db.collection('event_types')
  const eventTypeCount = await eventTypesCollection.countDocuments({ userId: businessId })
  
  // Build provisioning checklist
  const checklist = [
    { item: 'subscription_active', ok: subscriptionActive, details: subscription.status || 'none' },
    { item: 'stripe_customer_id', ok: !!subscription.stripeCustomerId, details: subscription.stripeCustomerId ? 'present' : 'missing' },
    { item: 'stripe_subscription_id', ok: !!subscription.stripeSubscriptionId, details: subscription.stripeSubscriptionId ? 'present' : 'missing' },
    { item: 'stripe_call_minutes_item', ok: !!subscription.stripeCallMinutesItemId, details: subscription.stripeCallMinutesItemId ? 'present' : 'missing' },
    { item: 'calendar_connected', ok: calendarConnected, details: calendarConnected ? `${selectedCalendars.length} calendars selected` : 'not connected' },
    { item: 'scheduling_handle', ok: hasHandle, details: scheduling.handle || 'not set' },
    { item: 'availability_configured', ok: hasAvailability, details: hasAvailability ? 'configured' : 'not configured' },
    { item: 'voice_agents', ok: hasVoiceConfig, details: `${voiceAgentCount} agent(s)` },
    { item: 'event_types', ok: eventTypeCount > 0, details: `${eventTypeCount} event type(s)` }
  ]
  
  const completedItems = checklist.filter(c => c.ok).length
  const totalItems = checklist.length
  const provisioningScore = Math.round((completedItems / totalItems) * 100)
  
  console.log(`[ops:${requestId}] tenant.provisioningSummary: Score ${provisioningScore}%`)
  
  return {
    ok: true,
    businessId,
    exists: true,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    subscription: {
      active: subscriptionActive,
      status: subscription.status || null,
      stripeCustomerId: subscription.stripeCustomerId || null,
      stripeSubscriptionId: subscription.stripeSubscriptionId || null,
      stripeCallMinutesItemId: subscription.stripeCallMinutesItemId || null,
      stripePriceId: planTier,
      currentPeriodEnd: subscription.currentPeriodEnd || null
    },
    calendar: {
      connected: calendarConnected,
      selectedCalendarCount: selectedCalendars.length
    },
    scheduling: {
      handle: scheduling.handle || null,
      hasAvailability
    },
    voice: {
      configured: hasVoiceConfig,
      agentCount: voiceAgentCount
    },
    eventTypes: {
      count: eventTypeCount
    },
    checklist,
    provisioningScore,
    summary: `Provisioning ${provisioningScore}% complete (${completedItems}/${totalItems} items)`
  }
}
