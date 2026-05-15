/**
 * Perplexity Sonar Pro — business extraction from URL (BOO-PERPLEXITY-DOMAIN-EXTRACT-1B).
 * Uses HTTPS fetch to POST /v1/sonar (OpenAPI) with json_schema + search_domain_filter.
 */

import { env } from '@/lib/env'
import { EXTRACTION_SCHEMA } from '@/lib/perplexity/extractionSchema'
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/perplexity/extractionPrompt'

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/v1/sonar'

/**
 * @param {string} url
 */
export function normalizeDomain(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    let u = raw
    if (!/^https?:\/\//i.test(u)) u = `https://${u.replace(/^\/+/, '')}`
    const parsed = new URL(u)
    let host = parsed.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    return host.replace(/[.]+$/, '')
  } catch {
    return ''
  }
}

/**
 * @param {unknown} response
 * @param {string} sourceUrl
 */
export function parseAndValidate(response, sourceUrl) {
  if (!response || typeof response !== 'object') {
    throw new Error('empty_perplexity_response')
  }
  const choices = /** @type {Record<string, unknown>} */ (response).choices
  const choice0 = Array.isArray(choices) && choices[0] && typeof choices[0] === 'object' ? choices[0] : null
  const message =
    choice0 && typeof /** @type {Record<string, unknown>} */ (choice0).message === 'object'
      ? /** @type {Record<string, unknown>} */ (choice0).message
      : null
  const content = message && typeof message.content === 'string' ? message.content.trim() : ''
  if (!content) throw new Error('empty_model_content')

  let data
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error('invalid_json_in_message')
  }
  if (!data || typeof data !== 'object') throw new Error('invalid_extraction_shape')

  const citationsRaw = /** @type {Record<string, unknown>} */ (response).citations
  const citations = Array.isArray(citationsRaw)
    ? citationsRaw.filter((x) => typeof x === 'string').map((x) => x.slice(0, 2048))
    : []
  const model =
    typeof /** @type {Record<string, unknown>} */ (response).model === 'string'
      ? /** @type {string} */ (/** @type {Record<string, unknown>} */ (response).model)
      : env.PERPLEXITY_MODEL || 'sonar-pro'

  return { data, citations, model, sourceUrl }
}

/**
 * @param {string} url
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function extractBusinessFromUrl(url, opts = {}) {
  const apiKey = env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('perplexity_not_configured')
  }

  const normalizedDomain = normalizeDomain(url)
  if (!normalizedDomain) {
    throw new Error('invalid_url')
  }

  const timeoutMs = env.PERPLEXITY_TIMEOUT_MS || 30000
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  const signal = opts.signal || controller.signal

  const body = {
    model: env.PERPLEXITY_MODEL || 'sonar-pro',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(url) }
    ],
    temperature: 0.1,
    max_tokens: 4000,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'BusinessExtraction',
        schema: EXTRACTION_SCHEMA,
        strict: true
      }
    },
    search_domain_filter: [normalizedDomain]
  }

  try {
    const res = await fetch(PERPLEXITY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    })

    const rawText = await res.text()
    let json = null
    try {
      json = rawText ? JSON.parse(rawText) : null
    } catch {
      json = null
    }

    if (!res.ok) {
      const msg = json && typeof json === 'object' && json.error && typeof json.error === 'object'
        ? JSON.stringify(json.error).slice(0, 400)
        : rawText.slice(0, 400)
      throw new Error(`perplexity_http_${res.status}: ${msg}`)
    }

    return parseAndValidate(json, url)
  } finally {
    clearTimeout(t)
  }
}
