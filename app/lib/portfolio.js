/**
 * Business portfolio / gallery — persisted on business doc + optional GridFS binary.
 */

import { normalizePlanKey } from '@/lib/plan-features'

export const PORTFOLIO_PRESET_CATEGORY_KEYS = [
  'haircuts',
  'color',
  'nails',
  'makeup',
  'skincare',
  'massage',
  'other'
]

/** Max upload size (bytes) — PNG/JPEG/WebP */
export const PORTFOLIO_MAX_FILE_BYTES = 5 * 1024 * 1024

export function getMaxPortfolioPhotos(plan) {
  const k = normalizePlanKey(plan)
  return k === 'starter' ? 5 : 20
}

function sortPortfolioEntries(list) {
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

/**
 * Safe list for public booking page (no gridFsId).
 */
export function sanitizePortfolioForPublic(portfolio) {
  const sorted = sortPortfolioEntries(
    Array.isArray(portfolio) ? portfolio.filter((p) => p && typeof p === 'object') : []
  )
  return sorted
    .filter((p) => typeof p.url === 'string' && p.url.trim().length > 0)
    .map((p, idx) => ({
      id: String(p.id || idx),
      url: p.url.trim(),
      caption: typeof p.caption === 'string' ? p.caption.slice(0, 200) : '',
      category: typeof p.category === 'string' ? p.category.slice(0, 80) : '',
      sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : idx
    }))
}

export function normalizePortfolioAfterMutation(portfolio) {
  const sorted = sortPortfolioEntries(
    Array.isArray(portfolio) ? portfolio.filter((p) => p && typeof p === 'object') : []
  )
  return sorted.map((p, i) => ({
    id: String(p.id || ''),
    url: typeof p.url === 'string' ? p.url : '',
    caption: typeof p.caption === 'string' ? p.caption.slice(0, 200) : '',
    category: typeof p.category === 'string' ? p.category.slice(0, 80) : '',
    sortOrder: i,
    ...(p.gridFsId ? { gridFsId: String(p.gridFsId) } : {})
  }))
}
