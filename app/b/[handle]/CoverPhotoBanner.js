'use client'

/**
 * BOO-106B: full-width cover from Cloudinary; gradient + initial fallback when no image.
 */
export default function CoverPhotoBanner({ coverImageUrl, businessName, formattedAddress }) {
  const name = (businessName || '').trim() || 'Business'
  const initial = name.charAt(0).toUpperCase()

  return (
    <div className="relative w-full min-h-[200px] sm:min-h-[240px] max-h-[min(40vh,320px)] overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#0f0f18] to-[#0a0a0f]">
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary CDN; above-fold hero
        <img
          src={coverImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-950/80 via-[#0f0f18] to-gray-950"
          aria-hidden
        >
          <span className="text-6xl sm:text-7xl font-bold text-white/20 select-none">{initial}</span>
        </div>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="relative z-10 flex h-full min-h-[200px] sm:min-h-[240px] flex-col justify-end px-4 pb-6 pt-16 md:px-6 md:pb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-md max-w-3xl">
          {name}
        </h1>
        {formattedAddress ? (
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl drop-shadow">{formattedAddress}</p>
        ) : null}
      </div>
    </div>
  )
}
