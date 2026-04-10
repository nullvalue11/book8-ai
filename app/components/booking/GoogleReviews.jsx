'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { sortGoogleReviewsForPublicDisplay } from '@/lib/googleReviewsSort'

/**
 * BOO-81B: Google Places reviews on public booking page
 * @param {{ handle: string }} props
 */
export default function GoogleReviews({ handle }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const h = typeof handle === 'string' ? handle.trim() : ''
    if (!h) {
      setLoading(false)
      return
    }
    fetch(`/api/public/google-reviews?handle=${encodeURIComponent(h)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [handle])

  if (loading || !data || data.rating == null) return null

  const total = typeof data.userRatingsTotal === 'number' ? data.userRatingsTotal : 0
  const raw = Array.isArray(data.reviews) ? data.reviews : []
  /** BOO-89B: same ordering as API; keeps UI correct if payload order ever changes */
  const reviews = sortGoogleReviewsForPublicDisplay(raw).slice(0, 5)

  return (
    <section className="mt-12 max-w-3xl mx-auto px-4" dir="ltr">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">What customers are saying</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="flex" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-5 h-5 ${
                    n <= Math.round(data.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500'
                  }`}
                />
              ))}
            </div>
            <span className="font-semibold text-white">{Number(data.rating).toFixed(1)}</span>
            <span className="text-gray-400">· {total} Google reviews</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Showing recent, highly rated reviews first
          </p>
        </div>
        <span className="text-sm text-gray-500 font-medium">Google</span>
      </div>

      {reviews.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review, i) => (
            <div key={`${review.time}-${i}`} className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
              <div className="flex items-center gap-3 mb-2">
                {review.profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.profilePhotoUrl}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{review.authorName}</p>
                  <p className="text-xs text-gray-500">{review.relativeTimeDescription}</p>
                </div>
              </div>
              <div className="flex mb-2" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-4 h-4 ${
                      n <= (review.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-500'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-300 line-clamp-4 whitespace-pre-wrap">{review.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {total > 5 ? (
        <p className="text-center text-sm text-gray-500 mt-4">Showing {reviews.length} of {total} reviews</p>
      ) : null}
    </section>
  )
}
