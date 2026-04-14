'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { buildGoogleMapsSearchUrl, buildGoogleStaticMapUrl } from '@/lib/staticMapUrl'

/**
 * BOO-106B: Static Maps image + attribution link (Google TOS).
 */
export default function BusinessMap({ location, formattedAddress, mapsApiKey }) {
  const [mapError, setMapError] = useState(false)

  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    return null
  }

  const staticUrl =
    mapsApiKey && !mapError
      ? buildGoogleStaticMapUrl({
          lat: location.lat,
          lng: location.lng,
          apiKey: mapsApiKey,
          width: 400,
          height: 200,
          zoom: 15
        })
      : null

  const openUrl = buildGoogleMapsSearchUrl({ lat: location.lat, lng: location.lng })

  if (!staticUrl && !openUrl && !formattedAddress) return null

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden" aria-label="Location">
      {staticUrl ? (
        <a
          href={openUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative aspect-[2/1] w-full bg-gray-900"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setMapError(true)}
          />
        </a>
      ) : (
        <div className="px-4 py-3 text-sm text-gray-400">
          {formattedAddress ? <p>{formattedAddress}</p> : null}
        </div>
      )}
      {openUrl ? (
        <div className="flex items-center justify-between gap-2 border-t border-gray-800 px-3 py-2.5 bg-gray-950/80">
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300"
          >
            View on Google Maps
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        </div>
      ) : null}
    </section>
  )
}
