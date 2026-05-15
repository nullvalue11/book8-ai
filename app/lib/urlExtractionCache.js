/**
 * Mongo cache for Perplexity URL extractions (BOO-PERPLEXITY-DOMAIN-EXTRACT-1B).
 */

import { getMongoDb } from '@/lib/mongoDb'
import { env } from '@/lib/env'

export const URL_EXTRACTIONS_COLLECTION = 'url_extractions'

let indexesEnsured = false

/**
 * @param {import('mongodb').Db} database
 * @param {number} ttlSeconds
 */
export async function ensureUrlExtractionIndexes(database, ttlSeconds) {
  if (indexesEnsured) return
  const col = database.collection(URL_EXTRACTIONS_COLLECTION)
  await col.createIndex({ normalizedDomain: 1 }, { unique: true })
  await col.createIndex({ extractedAt: 1 }, { expireAfterSeconds: ttlSeconds })
  indexesEnsured = true
}

/**
 * @param {string} normalizedDomain
 */
export async function findUrlExtractionCached(normalizedDomain) {
  const database = await getMongoDb()
  const cacheHours = env.PERPLEXITY_EXTRACTION_CACHE_HOURS ?? 24
  await ensureUrlExtractionIndexes(database, Math.max(3600, cacheHours * 3600))
  const doc = await database.collection(URL_EXTRACTIONS_COLLECTION).findOne({ normalizedDomain })
  return doc
}

/**
 * @param {{
 *   normalizedDomain: string,
 *   originalUrl: string,
 *   extraction: object,
 *   citations: string[],
 *   model: string
 * }} fields
 */
export async function insertUrlExtractionCache(fields) {
  const database = await getMongoDb()
  const now = new Date()
  await database.collection(URL_EXTRACTIONS_COLLECTION).insertOne({
    normalizedDomain: fields.normalizedDomain,
    originalUrl: fields.originalUrl,
    extraction: fields.extraction,
    citations: Array.isArray(fields.citations) ? fields.citations : [],
    model: fields.model,
    extractedAt: now,
    createdAt: now,
    updatedAt: now
  })
}
