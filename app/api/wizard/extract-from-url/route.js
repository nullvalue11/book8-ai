/**
 * POST /api/wizard/extract-from-url — Perplexity Sonar + Mongo cache (BOO-PERPLEXITY-DOMAIN-EXTRACT-1B).
 */

import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { extractBusinessFromUrl, normalizeDomain } from '@/lib/perplexity/client'
import { findUrlExtractionCached, insertUrlExtractionCache } from '@/lib/urlExtractionCache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req) {
  try {
    let body = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 })
    }

    const domain = normalizeDomain(url)
    if (!domain) {
      return NextResponse.json({ error: 'invalid url' }, { status: 400 })
    }

    let cached = null
    try {
      cached = await findUrlExtractionCached(domain)
    } catch (e) {
      console.warn('[extract-from-url] cache read failed', e?.message || e)
    }

    if (cached && cached.extraction) {
      return NextResponse.json({
        source: 'cache',
        extractedAt: cached.extractedAt,
        data: cached.extraction,
        citations: Array.isArray(cached.citations) ? cached.citations : []
      })
    }

    if (!env.PERPLEXITY_API_KEY) {
      return NextResponse.json(
        {
          fallbackToVanilla: true,
          error: 'perplexity_not_configured',
          message: 'Perplexity API key is not configured'
        },
        { status: 200 }
      )
    }

    const result = await extractBusinessFromUrl(url)

    void insertUrlExtractionCache({
      normalizedDomain: domain,
      originalUrl: url,
      extraction: result.data,
      citations: result.citations,
      model: result.model
    }).catch((err) => {
      if (err && typeof err === 'object' && err.code === 11000) return
      console.error('[extract-from-url] cache write failed:', err?.message || err)
    })

    return NextResponse.json({
      source: 'perplexity',
      extractedAt: new Date(),
      data: result.data,
      citations: result.citations
    })
  } catch (err) {
    console.error('[extract-from-url] failed:', err)
    return NextResponse.json(
      {
        error: 'extraction_failed',
        message: err?.message || String(err),
        fallbackToVanilla: true
      },
      { status: 200 }
    )
  }
}
