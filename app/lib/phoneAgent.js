/**
 * Phone Agent Helper Functions
 * 
 * This module provides utilities for authenticating and resolving
 * AI phone agent requests (e.g., from Vapi, Retell, etc.)
 * 
 * Data Model:
 * Users can have a `phoneAgents` array in their document:
 * {
 *   phoneAgents: [{
 *     phoneNumber: "+15555551234",
 *     label: "Main line",
 *     agentApiKey: "ag_sk_xxxxx",  // Secret key for auth
 *     defaultTimezone: "America/Toronto"
 *   }]
 * }
 */

import { MongoClient } from 'mongodb'
import { env } from '@/lib/env'
import crypto from 'crypto'

let client, db

async function connect() {
  if (!client) {
    client = new MongoClient(env.MONGO_URL)
    await client.connect()
    db = client.db(env.DB_NAME)
  }
  return db
}

/**
 * Find the owner (user/business) by their agent API key
 * 
 * @param {string} agentApiKey - The secret API key provided by the phone agent
 * @returns {Promise<{owner: object, agent: object, handle: string, timezone: string} | null>}
 *          Returns the owner document, matched agent config, handle, and timezone
 *          Returns null if the key is invalid or not found
 */
export async function findAgentOwnerByKey(agentApiKey) {
  if (!agentApiKey || typeof agentApiKey !== 'string') {
    return null
  }
  
  const database = await connect()
  
  // Find user with this agent API key in their phoneAgents array
  const owner = await database.collection('users').findOne({
    'phoneAgents.agentApiKey': agentApiKey
  })
  
  if (!owner) {
    return null
  }
  
  // Find the specific agent config that matched
  const matchedAgent = owner.phoneAgents?.find(
    agent => agent.agentApiKey === agentApiKey
  )
  
  if (!matchedAgent) {
    return null
  }
  
  // Get the handle from scheduling settings
  const handle = owner.scheduling?.handle || null
  
  // Determine timezone: agent default > owner scheduling > UTC
  const timezone = matchedAgent.defaultTimezone || 
                   owner.scheduling?.timeZone || 
                   'UTC'
  
  return {
    owner,
    agent: matchedAgent,
    handle,
    timezone
  }
}

/**
 * Generate a secure agent API key
 * Format: ag_sk_[32 random hex chars]
 * 
 * @returns {string} A new agent API key
 */
export function generateAgentApiKey() {
  const randomBytes = crypto.randomBytes(16).toString('hex')
  return `ag_sk_${randomBytes}`
}

/**
 * Validate agent API key format
 * 
 * @param {string} key - The key to validate
 * @returns {boolean} True if the key has valid format
 */
export function isValidAgentKeyFormat(key) {
  if (!key || typeof key !== 'string') return false
  return /^ag_sk_[a-f0-9]{32}$/.test(key)
}

/**
 * Standard error response for unauthorized agent requests
 */
export const AGENT_UNAUTHORIZED_ERROR = {
  ok: false,
  code: 'AGENT_UNAUTHORIZED',
  message: 'Invalid agent API key.'
}

/**
 * Log an agent API call for debugging/monitoring
 * 
 * @param {string} route - The API route (e.g., 'availability', 'book')
 * @param {object} context - Context info (handle, success, etc.)
 */
export function logAgentCall(route, context = {}) {
  const timestamp = new Date().toISOString()
  const { handle, success, error, agentLabel } = context
  
  console.log(`[agent:${route}] ${timestamp}`, {
    handle: handle || 'unknown',
    agent: agentLabel || 'unnamed',
    success: success ?? null,
    error: error || null
  })
}
