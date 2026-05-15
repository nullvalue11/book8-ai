/**
 * Preserve /setup handoff query params across OAuth and credential auth (BOO-AUTH-CTX-PRESERVATION-1B).
 * BOO-AUTH-CTX-PERPLEXITY-FIX-1B: normalize placeId vs sessionToken (swap / misplaced UUID).
 */

export const SETUP_AUTH_RETURN_CTX_KEY = 'book8:return_ctx'

const HANDOFF_PARAM_KEYS = new Set([
  'placeId',
  'sessionToken',
  'url',
  'mode',
  'newBusiness',
  'registerNew',
  'profileSource'
])

/** UUID v4 (session tokens from hero autocomplete use this shape). */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {string} s
 */
export function looksLikeSessionTokenUuid(s) {
  return typeof s === 'string' && UUID_V4_RE.test(s.trim())
}

/**
 * Google Place IDs are opaque strings; they are never UUID-shaped.
 * @param {string} s
 */
export function looksLikeGooglePlaceId(s) {
  if (typeof s !== 'string' || s.length < 15) return false
  const t = s.trim()
  if (looksLikeSessionTokenUuid(t)) return false
  return /^[A-Za-z0-9_+:-]+$/.test(t)
}

/**
 * Fix swapped placeId/sessionToken or a UUID stuck in the placeId slot.
 * Mutates `ctx` in place (only placeId / sessionToken keys).
 * @param {Record<string, string>} ctx
 */
export function normalizeHandoffContextRecord(ctx) {
  if (!ctx || typeof ctx !== 'object') return ctx
  const pid = typeof ctx.placeId === 'string' ? ctx.placeId.trim() : ''
  const st = typeof ctx.sessionToken === 'string' ? ctx.sessionToken.trim() : ''
  if (!pid && !st) return ctx

  if (looksLikeSessionTokenUuid(pid) && looksLikeGooglePlaceId(st)) {
    ctx.placeId = st
    ctx.sessionToken = pid
    return ctx
  }
  if (looksLikeSessionTokenUuid(pid) && !st) {
    ctx.sessionToken = pid
    delete ctx.placeId
    return ctx
  }
  return ctx
}

/**
 * @param {URLSearchParams} params
 * @returns {Record<string, string>}
 */
function handoffPayloadFromUrlParams(params) {
  /** @type {Record<string, string>} */
  const o = {}
  for (const [k, v] of params.entries()) {
    if (!v || !String(v).trim()) continue
    if (HANDOFF_PARAM_KEYS.has(k) || k.startsWith('utm_')) o[k] = String(v).trim()
  }
  normalizeHandoffContextRecord(o)
  return o
}

/**
 * @param {import('next/navigation').ReadonlyURLSearchParams | URLSearchParams | null | undefined} searchParams
 * @returns {Array<[string, string]>}
 */
export function collectHandoffQueryEntries(searchParams) {
  if (!searchParams) return []
  const o = handoffPayloadFromUrlParams(new URLSearchParams(searchParams.toString()))
  return Object.entries(o)
}

/**
 * Path passed to NextAuth `callbackUrl` → `/auth/oauth-callback?redirect=…` so Google/Microsoft return here with full query.
 * @param {import('next/navigation').ReadonlyURLSearchParams | URLSearchParams | null | undefined} searchParams
 */
export function buildSetupOauthRedirectPath(searchParams) {
  const sp = new URLSearchParams()
  for (const [k, v] of collectHandoffQueryEntries(searchParams)) {
    sp.set(k, v)
  }
  const qs = sp.toString()
  return qs ? `/setup?${qs}` : '/setup'
}

/** Snapshot current window query into sessionStorage before leaving for OAuth or posting credentials. */
export function captureSetupAuthReturnContext() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const o = handoffPayloadFromUrlParams(params)
    const keys = Object.keys(o)
    if (keys.length === 0) return
    const ctx = { returnPath: '/setup', ...o }
    sessionStorage.setItem(SETUP_AUTH_RETURN_CTX_KEY, JSON.stringify(ctx))
  } catch {
    /* quota / private mode */
  }
}

export function clearSetupAuthReturnContext() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SETUP_AUTH_RETURN_CTX_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Record<string, string> | null}
 */
function readAndRemoveReturnContext() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SETUP_AUTH_RETURN_CTX_KEY)
    if (!raw) return null
    sessionStorage.removeItem(SETUP_AUTH_RETURN_CTX_KEY)
    const ctx = JSON.parse(raw)
    if (!ctx || typeof ctx !== 'object') return null
    const rec = /** @type {Record<string, string>} */ (ctx)
    normalizeHandoffContextRecord(rec)
    return rec
  } catch {
    try {
      sessionStorage.removeItem(SETUP_AUTH_RETURN_CTX_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
}

/**
 * Build query string from stored ctx (excluding returnPath).
 * @param {Record<string, string>} ctx
 */
export function returnContextToSearchParams(ctx) {
  const c = { ...ctx }
  delete c.returnPath
  normalizeHandoffContextRecord(c)
  const newParams = new URLSearchParams()
  for (const k of HANDOFF_PARAM_KEYS) {
    const v = c[k]
    if (typeof v === 'string' && v.trim()) newParams.set(k, v.trim())
  }
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith('utm_') && typeof v === 'string' && v.trim()) newParams.set(k, v.trim())
  }
  return newParams
}

/**
 * Read stored handoff once (removes key). Caller should merge or discard.
 * @returns {Record<string, string> | null}
 */
export function consumeSetupAuthReturnContext() {
  return readAndRemoveReturnContext()
}
