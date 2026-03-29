import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Returns false if either value is empty/undefined.
 */
export function safeCompare(a, b) {
  if (!a || !b) return false
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
