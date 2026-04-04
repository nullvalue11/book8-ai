/**
 * NEXT_PUBLIC_* values for client components only.
 * Do not import app/lib/env.js from "use client" modules — it embeds server secrets.
 */

export const ENABLE_METERED_BILLING_UI =
  process.env.NEXT_PUBLIC_ENABLE_METERED_BILLING === 'true'

/** Browser Maps Embed / JS API key (restricted by HTTP referrer). */
export const GOOGLE_MAPS_BROWSER_KEY =
  (typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY === 'string' &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY.trim()) ||
  ''
