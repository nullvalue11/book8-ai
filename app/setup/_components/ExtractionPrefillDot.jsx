'use client'

import React from 'react'

/**
 * @param {{ show?: boolean }} props
 */
export default function ExtractionPrefillDot({ show }) {
  if (!show) return null
  return (
    <span
      className="ms-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-[#A78BFA] align-middle ring-2 ring-[#A78BFA]/30"
      title="Pre-filled from your website"
      aria-label="Pre-filled from your website"
    />
  )
}
