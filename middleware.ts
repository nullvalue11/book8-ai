/**
 * Next.js Middleware
 * 
 * Provides Basic Auth protection for Ops Console routes:
 * - /ops/* (UI pages)
 * - /api/ops/* (proxy API)
 * 
 * Credentials: OPS_CONSOLE_USER / OPS_CONSOLE_PASS env vars
 * 
 * NOTE: Middleware runs in Edge Runtime and cannot import the centralized
 * env module. Environment variables are accessed via process.env which is
 * allowed in middleware. This is the only exception to the "use env module" rule.
 */

import { NextRequest, NextResponse } from 'next/server'

// Routes that require Basic Auth
const PROTECTED_PATHS = ['/ops', '/api/ops']

/**
 * Check if a path requires Basic Auth
 */
function requiresBasicAuth(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )
}

/**
 * Validate Basic Auth credentials
 * 
 * Note: We use process.env directly here because middleware runs in Edge Runtime
 * and cannot import the server-side env module. This is an intentional exception.
 */
function isValidAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false
  }
  
  // Edge Runtime compatible env access
  const expectedUser = process.env.OPS_CONSOLE_USER || 'admin'
  const expectedPass = process.env.OPS_CONSOLE_PASS || 'changeme'
  
  try {
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8')
    const [username, password] = credentials.split(':')
    
    return username === expectedUser && password === expectedPass
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Only apply Basic Auth to protected paths
  if (!requiresBasicAuth(pathname)) {
    return NextResponse.next()
  }
  
  // Check Basic Auth
  const authHeader = request.headers.get('authorization')
  
  if (!isValidAuth(authHeader)) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Ops Console"',
        'Content-Type': 'text/plain'
      }
    })
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match /ops and /ops/*
    '/ops/:path*',
    '/ops',
    // Match /api/ops and /api/ops/*
    '/api/ops/:path*',
    '/api/ops'
  ]
}
