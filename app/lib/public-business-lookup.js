/**
 * Resolve a public /b/{handle} business document with resilient matching
 * (case variants, alternate slug fields, display-name fallback when handle is unset).
 */

import { generateHandle } from '@/lib/schemas/business'

export function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * @param {import('mongodb').Collection} collection
 * @param {string} handle
 * @returns {Promise<object | null>}
 */
export async function findBusinessByPublicHandle(collection, handle) {
  const raw = String(handle || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()

  const orClauses = [
    { handle: lower },
    { handle: raw },
    { businessId: raw },
    { id: raw },
    { bookingSlug: lower },
    { bookingSlug: raw },
    { slug: lower },
    { slug: raw }
  ]
  try {
    orClauses.push({ handle: new RegExp(`^${escapeRegex(lower)}$`, 'i') })
  } catch {
    /* ignore bad pattern */
  }

  let business = await collection.findOne({ $or: orClauses })
  if (business) return business

  const hyphenAsWords = generateHandle(raw.replace(/-/g, ' '))
  if (hyphenAsWords && hyphenAsWords !== lower) {
    business = await collection.findOne({ handle: hyphenAsWords })
    if (business) return business
  }

  const nameGuess = lower.replace(/-/g, ' ').trim()
  if (nameGuess.length >= 2) {
    business = await collection.findOne({
      name: new RegExp(`^\\s*${escapeRegex(nameGuess)}\\s*$`, 'i')
    })
  }

  return business || null
}
