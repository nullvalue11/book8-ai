'use client'

import React from 'react'
import { cn } from '@/lib/utils'

const INSTAGRAM_URL = 'https://www.instagram.com/book8.ai/'
const TIKTOK_URL = 'https://www.tiktok.com/@book8.ai'

function InstagramIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 11-.001 2.881 1.44 1.44 0 01.001-2.881z" />
    </svg>
  )
}

function TikTokIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  )
}

const linkBase =
  'inline-flex items-center justify-center rounded-full p-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#0A0A0F]'

export default function SocialMediaLinks({ className = '' }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Book8-AI on Instagram"
        className={`${linkBase} bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white shadow-md shadow-[#bc1888]/20 hover:brightness-110 hover:scale-105 focus-visible:ring-pink-400`}
      >
        <InstagramIcon className="w-5 h-5" />
      </a>
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Book8-AI on TikTok"
        className={`${linkBase} bg-[#010101] text-white border border-white/15 hover:border-[#25F4EE]/60 hover:shadow-[0_0_20px_-4px_rgba(37,244,238,0.45)] hover:scale-105 focus-visible:ring-[#25F4EE]`}
      >
        <TikTokIcon className="w-5 h-5" />
      </a>
    </div>
  )
}
