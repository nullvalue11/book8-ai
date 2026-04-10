/**
 * BOO-89B: Re-rank Google Places review snippets for public booking pages.
 * Google's default order is "most relevant" and can surface old 1★ reviews first.
 * We prefer recent, highly rated reviews for prospect-facing demos.
 *
 * @param {Array<{ rating?: number, time?: number, [k: string]: unknown }>} reviews
 * @returns {typeof reviews}
 */
export function sortGoogleReviewsForPublicDisplay(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) return []
  const now = Date.now()
  const scored = reviews.map((r) => {
    const rating = typeof r.rating === 'number' ? r.rating : Number(r.rating) || 0
    const timeSec = typeof r.time === 'number' ? r.time : 0
    const ageMs = timeSec > 0 ? now - timeSec * 1000 : Number.POSITIVE_INFINITY
    const ageMonths = ageMs === Number.POSITIVE_INFINITY ? 999 : ageMs / (1000 * 60 * 60 * 24 * 30)
    const recencyWeight = Math.max(0, 24 - ageMonths) / 24
    const score = rating * (0.5 + 0.5 * recencyWeight)
    return { row: r, score, timeSec }
  })
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.timeSec - a.timeSec
  })
  return scored.map((x) => x.row)
}
