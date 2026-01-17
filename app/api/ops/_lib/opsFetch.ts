/**
 * Ops Fetch Helper
 * 
 * Server-side helper for calling internal ops endpoints.
 * Adds authentication headers and caller identity.
 * 
 * IMPORTANT: In Vercel serverless, we cannot use localhost.
 * We must use the actual deployed URL to call internal APIs.
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
 * Get environment variables at runtime
 * 
 * CRITICAL: In production (Vercel serverless), localhost doesn't work.
 * We ALWAYS prefer BASE_URL (NEXT_PUBLIC_BASE_URL) over localhost.
 */
async function getEnvConfig(): Promise<{ baseUrl: string; secret: string }> {
  try {
    // @ts-ignore - env.js is a JavaScript module  
    const envModule = await import('@/lib/env.js')
    const env = envModule.env || envModule.default?.env || envModule
    
    if (env && typeof env === 'object') {
      // Determine the base URL to use
      let baseUrl: string
      
      // Check if we're in production/Vercel (not localhost)
      const isProduction = env.IS_PRODUCTION || env.NODE_ENV === 'production'
      const opsInternalUrl = env.OPS_INTERNAL_BASE_URL || ''
      const publicBaseUrl = env.BASE_URL || ''
      
      // In production, NEVER use localhost - always use the public base URL
      if (isProduction || opsInternalUrl.includes('localhost') || !opsInternalUrl) {
        // Use the public base URL (the deployed app URL)
        baseUrl = publicBaseUrl || 'http://localhost:3000'
      } else {
        // Use the explicitly configured internal URL (only if it's not localhost)
        baseUrl = opsInternalUrl
      }
      
      // Final safety check: if we're still on localhost in production, use BASE_URL
      if (isProduction && baseUrl.includes('localhost')) {
        baseUrl = publicBaseUrl
      }
      
      const secret = env.OPS_INTERNAL_SECRET || 'ops-dev-secret-change-me'
      
      console.log(`[opsFetch] Environment: ${env.NODE_ENV}, baseUrl resolved to: ${baseUrl}`)
      
      return { baseUrl, secret }
    }
  } catch (err) {
    console.warn('[opsFetch] Failed to load env module:', err)
  }
  
  // Fallback for development only
  return {
    baseUrl: 'http://localhost:3000',
    secret: 'ops-dev-secret-change-me'
  }
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
  
  let envConfig: { baseUrl: string; secret: string }
  
  try {
    envConfig = await getEnvConfig()
  } catch (err) {
    console.error('[opsFetch] getEnvConfig failed:', err)
    return {
      ok: false,
      status: 500,
      data: null,
      error: 'Failed to load configuration'
    }
  }
  
  const { baseUrl, secret } = envConfig
  
  let url: string
  try {
    url = buildUrl(baseUrl, path, params)
    console.log(`[opsFetch] Fetching: ${method} ${url}`)
  } catch (err) {
    console.error('[opsFetch] buildUrl failed:', err)
    return {
      ok: false,
      status: 500,
      data: null,
      error: 'Failed to build URL'
    }
  }
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-book8-internal-secret': secret,
        'x-book8-caller': OPS_CALLER_IDENTITY
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
    
    let data: any = null
    try {
      data = await response.json()
    } catch {
      // Response might not be JSON
    }
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      error: response.ok ? undefined : (data?.error?.message || `HTTP ${response.status}`),
      headers: rateLimitHeaders
    }
    
  } catch (fetchError: any) {
    clearTimeout(timeoutId)
    
    if (fetchError.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        data: null,
        error: 'Request timeout'
      }
    }
    
    console.error('[opsFetch] Fetch error:', fetchError.message, 'URL:', url)
    return {
      ok: false,
      status: 500,
      data: null,
      error: `Fetch failed: ${fetchError.message}`
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
