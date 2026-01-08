/**
 * Ops Fetch Helper
 * 
 * Server-side helper for calling internal ops endpoints.
 * Adds authentication headers and caller identity.
 * 
 * The x-book8-caller header identifies traffic from the Ops Console UI,
 * allowing separate rate limit tracking from n8n and other callers.
 */

// Caller identity for rate limiting - identifies Ops Console traffic
const OPS_CALLER_IDENTITY = 'ops_console'

export interface OpsFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  params?: Record<string, string | number | boolean | undefined>
  timeout?: number
}

export interface OpsFetchResult<T = any> {
  ok: boolean
  status: number
  data: T | null
  error?: string
  headers?: {
    rateLimitLimit?: string
    rateLimitRemaining?: string
    rateLimitReset?: string
  }
}

/**
 * Get environment variables at runtime (not at module load time)
 * Uses dynamic import to avoid module-level initialization issues in serverless
 */
async function getEnvConfig() {
  // Dynamic import to ensure env is loaded at request time, not module load time
  // @ts-ignore - env.js is a JavaScript module
  const { env } = await import('@/lib/env.js')
  const baseUrl = env.OPS_INTERNAL_BASE_URL || 'http://localhost:3000'
  const secret = env.OPS_INTERNAL_SECRET || 'ops-dev-secret-change-me'
  return { baseUrl, secret }
}

/**
 * Build URL with query parameters
 */
function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, baseUrl)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    })
  }
  
  return url.toString()
}

/**
 * Fetch from internal ops API with authentication and caller identity
 */
export async function opsFetch<T = any>(
  path: string,
  options: OpsFetchOptions = {}
): Promise<OpsFetchResult<T>> {
  const { method = 'GET', body, params, timeout = 30000 } = options
  
  // Get env config at runtime
  const { baseUrl, secret } = await getEnvConfig()
  
  const url = buildUrl(baseUrl, path, params)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret,
        'x-book8-caller': OPS_CALLER_IDENTITY  // Identify as ops_console for rate limiting
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store'
    })
    
    clearTimeout(timeoutId)
    
    // Extract rate limit headers
    const rateLimitHeaders = {
      rateLimitLimit: response.headers.get('X-RateLimit-Limit') || undefined,
      rateLimitRemaining: response.headers.get('X-RateLimit-Remaining') || undefined,
      rateLimitReset: response.headers.get('X-RateLimit-Reset') || undefined
    }
    
    let data = null
    try {
      data = await response.json()
    } catch {
      // Response might not be JSON
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : data?.error?.message || `HTTP ${response.status}`,
      headers: rateLimitHeaders
    }
    
  } catch (error: any) {
    clearTimeout(timeoutId)
    
    if (error.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        data: null,
        error: 'Request timeout'
      }
    }
    
    return {
      ok: false,
      status: 500,
      data: null,
      error: error.message || 'Internal error'
    }
  }
}

/**
 * Helper for GET requests
 */
export function opsGet<T = any>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<OpsFetchResult<T>> {
  return opsFetch<T>(path, { method: 'GET', params })
}

/**
 * Helper for POST requests
 */
export function opsPost<T = any>(
  path: string,
  body?: any
): Promise<OpsFetchResult<T>> {
  return opsFetch<T>(path, { method: 'POST', body })
}
