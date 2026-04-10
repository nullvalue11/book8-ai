/**
 * BOO-89B — public booking pages re-rank Google review snippets by rating × recency.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { sortGoogleReviewsForPublicDisplay } from '../app/lib/googleReviewsSort.js'

function secAgo(days) {
  return Math.floor(Date.now() / 1000) - Math.round(days * 24 * 60 * 60)
}

describe('sortGoogleReviewsForPublicDisplay (BOO-89B)', () => {
  it('ranks recent 4★ above a 2-year-old 1★', () => {
    const oldOne = { rating: 1, time: secAgo(800), authorName: 'Z' }
    const recentFour = { rating: 4, time: secAgo(45), authorName: 'A' }
    const out = sortGoogleReviewsForPublicDisplay([oldOne, recentFour])
    assert.strictEqual(out[0].authorName, 'A')
    assert.strictEqual(out[1].authorName, 'Z')
  })

  it('drops very old 1★ from top 5 when six reviews are available', () => {
    const reviews = [
      { rating: 5, time: secAgo(20), authorName: 'a' },
      { rating: 4, time: secAgo(40), authorName: 'b' },
      { rating: 5, time: secAgo(60), authorName: 'c' },
      { rating: 4, time: secAgo(100), authorName: 'd' },
      { rating: 5, time: secAgo(150), authorName: 'e' },
      { rating: 1, time: secAgo(900), authorName: 'bad' }
    ]
    const top = sortGoogleReviewsForPublicDisplay(reviews).slice(0, 5)
    assert.strictEqual(top.some((r) => r.authorName === 'bad'), false)
  })

  it('ranks a 1-month 4★ above a 7-year-old 5★ (LezRod-style)', () => {
    const ancientFive = { rating: 5, time: secAgo(7 * 365), authorName: 'LezRod' }
    const recentFour = { rating: 4, time: secAgo(30), authorName: 'New' }
    const out = sortGoogleReviewsForPublicDisplay([ancientFive, recentFour])
    assert.strictEqual(out[0].authorName, 'New')
  })

  it('returns [] for non-array or empty input', () => {
    assert.deepStrictEqual(sortGoogleReviewsForPublicDisplay(null), [])
    assert.deepStrictEqual(sortGoogleReviewsForPublicDisplay([]), [])
  })
})
