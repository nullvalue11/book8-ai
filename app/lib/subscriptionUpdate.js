/**
 * Subscription Update Helper
 * 
 * Handles atomic MongoDB updates for subscription fields,
 * ensuring subscription is an object before setting nested fields.
 * 
 * This fixes the error: "Cannot create field 'stripeCustomerId' in element { subscription: null }"
 */

/**
 * Atomically update subscription fields on a user document.
 * Uses MongoDB pipeline update to ensure subscription is an object before setting nested fields.
 * 
 * @param {Collection} usersCollection - MongoDB users collection
 * @param {string} userId - User ID to update
 * @param {object} subscriptionFields - Fields to set on subscription (without 'subscription.' prefix)
 * @returns {Promise<UpdateResult>}
 * 
 * @example
 * await updateSubscriptionFields(db.collection('users'), userId, {
 *   stripeCustomerId: 'cus_xxx',
 *   stripeSubscriptionId: 'sub_xxx',
 *   status: 'active'
 * })
 */
export async function updateSubscriptionFields(usersCollection, userId, subscriptionFields) {
  // Build the nested field object with 'subscription.' prefix
  const nestedFields = {}
  for (const [key, value] of Object.entries(subscriptionFields)) {
    nestedFields[`subscription.${key}`] = value
  }
  
  // Use MongoDB pipeline update for atomic operation (MongoDB 4.2+)
  // This ensures subscription is an object before setting nested fields
  return usersCollection.updateOne(
    { id: userId },
    [
      // First stage: Ensure subscription is an object (not null/undefined)
      { 
        $set: { 
          subscription: { 
            $ifNull: ['$subscription', {}] 
          } 
        } 
      },
      // Second stage: Set the actual fields
      { 
        $set: nestedFields 
      }
    ]
  )
}

/**
 * Atomically update subscription fields by customer ID.
 * 
 * @param {Collection} usersCollection - MongoDB users collection
 * @param {string} customerId - Stripe customer ID
 * @param {object} subscriptionFields - Fields to set on subscription
 * @returns {Promise<UpdateResult>}
 */
export async function updateSubscriptionByCustomerId(usersCollection, customerId, subscriptionFields) {
  // Build the nested field object
  const nestedFields = {}
  for (const [key, value] of Object.entries(subscriptionFields)) {
    nestedFields[`subscription.${key}`] = value
  }
  
  return usersCollection.updateOne(
    { 'subscription.stripeCustomerId': customerId },
    [
      { $set: { subscription: { $ifNull: ['$subscription', {}] } } },
      { $set: nestedFields }
    ]
  )
}

/**
 * Fallback update method for environments that don't support pipeline updates.
 * Uses a two-step approach: first ensure subscription is an object, then set fields.
 * 
 * @param {Collection} usersCollection - MongoDB users collection
 * @param {string} userId - User ID to update
 * @param {object} subscriptionFields - Fields to set on subscription
 * @returns {Promise<void>}
 */
export async function updateSubscriptionFieldsFallback(usersCollection, userId, subscriptionFields) {
  // Step 1: Ensure subscription is an object (only if it's null)
  await usersCollection.updateOne(
    { id: userId, $or: [{ subscription: null }, { subscription: { $exists: false } }] },
    { $set: { subscription: {} } }
  )
  
  // Step 2: Set the nested fields
  const nestedFields = {}
  for (const [key, value] of Object.entries(subscriptionFields)) {
    nestedFields[`subscription.${key}`] = value
  }
  
  await usersCollection.updateOne(
    { id: userId },
    { $set: nestedFields }
  )
}
