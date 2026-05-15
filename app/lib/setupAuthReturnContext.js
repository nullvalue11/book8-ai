/**
 * Preserve /setup handoff query params across OAuth and credential auth (BOO-AUTH-CTX-PRESERVATION-1B).
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

/**
 * @param {import('next/navigation').ReadonlyURLSearchParams | URLSearchParams | null | undefined} searchParams
 * @returns {Array<[string, string]>}
 */
export function collectHandoffQueryEntries(searchParams) {
  /** @type {Array<[string, string]>} */
  const out = []
  if (!searchParams) return out
  for (const [k, v] of searchParams.entries()) {
    if (!v || !String(v).trim()) continue
    if (HANDOFF_PARAM_KEYS.has(k) || k.startsWith('utm_')) out.push([k, String(v).trim()])
  }
  return out
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
    /** @type {Record<string, string>} */
    const ctx = { returnPath: '/setup' }
    for (const [k, v] of params.entries()) {
      if (!v || !String(v).trim()) continue
      if (HANDOFF_PARAM_KEYS.has(k) || k.startsWith('utm_')) ctx[k] = String(v).trim()
    }
    const keys = Object.keys(ctx).filter((k) => k !== 'returnPath')
    if (keys.length === 0) return
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
    return /** @type {Record<string, string>} */ (ctx)
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
  const newParams = new URLSearchParams()
  for (const k of HANDOFF_PARAM_KEYS) {
    const v = ctx[k]
    if (typeof v === 'string' && v.trim()) newParams.set(k, v.trim())
  }
  for (const [k, v] of Object.entries(ctx)) {
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
