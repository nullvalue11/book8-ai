/**
 * BOO-96B — normalize Places Details (core + legacy shapes) and partial-payload detection.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePlacesDetailsToReviewCache,
  isPartialGoogleReviewsPayload
} from '../app/lib/googlePlaceReviewsNormalize.js'

describe('normalizePlacesDetailsToReviewCache (BOO-96B)', () => {
  it('legacy Places Details: status + result wrapper', () => {
    const raw = {
      status: 'OK',
      result: {
        rating: 4.5,
        user_ratings_total: 124,
        reviews: [
          {
            author_name: 'Alex',
            rating: 5,
            text: 'Great wash',
            time: Math.floor(Date.now() / 1000) - 86400
          }
        ]
      }
    }
    const out = normalizePlacesDetailsToReviewCache(raw)
    assert.ok(out)
    assert.equal(out.rating, 4.5)
    assert.equal(out.userRatingsTotal, 124)
    assert.equal(out.reviews.length, 1)
    assert.equal(out.reviews[0].authorName, 'Alex')
  })

  it('core-style: nested data + reviewCount + camelCase reviews', () => {
    const raw = {
      ok: true,
      data: {
        rating: 4.5,
        reviewCount: 88,
        reviews: [
          {
            authorName: 'Sam',
            rating: 4,
            text: { text: 'Good service' },
            publishTime: new Date().toISOString()
          }
        ]
      }
    }
    const out = normalizePlacesDetailsToReviewCache(raw)
    assert.ok(out)
    assert.equal(out.rating, 4.5)
    assert.equal(out.userRatingsTotal, 88)
    assert.equal(out.reviews.length, 1)
    assert.equal(out.reviews[0].text, 'Good service')
  })

  it('core-style: userRatingsTotal string + payload wrapper', () => {
    const raw = {
      payload: {
        rating: 4.2,
        userRatingsTotal: '42',
        reviews: []
      }
    }
    const out = normalizePlacesDetailsToReviewCache(raw)
    assert.ok(out)
    assert.equal(out.rating, 4.2)
    assert.equal(out.userRatingsTotal, 42)
  })

  it('returns null for empty / malformed', () => {
    assert.equal(normalizePlacesDetailsToReviewCache(null), null)
    assert.equal(normalizePlacesDetailsToReviewCache(undefined), null)
    assert.equal(normalizePlacesDetailsToReviewCache('x'), null)
    assert.equal(normalizePlacesDetailsToReviewCache({}), null)
  })
})

describe('isPartialGoogleReviewsPayload (BOO-96B)', () => {
  it('rating with zero review rows is partial (legacy fallback)', () => {
    assert.equal(
      isPartialGoogleReviewsPayload({
        rating: 4.5,
        userRatingsTotal: 124,
        reviews: []
      }),
      true
    )
  })

  it('rating with snippets is not partial', () => {
    assert.equal(
      isPartialGoogleReviewsPayload({
        rating: 4.5,
        userRatingsTotal: 124,
        reviews: [{ authorName: 'x', rating: 5, text: '', time: 1 }]
      }),
      false
    )
  })

  it('null / non-object is partial', () => {
    assert.equal(isPartialGoogleReviewsPayload(null), true)
    assert.equal(isPartialGoogleReviewsPayload(undefined), true)
  })
})
