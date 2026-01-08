'use client'

/**
 * RateLimitStatus Component
 * 
 * Displays rate limit information in the Ops Console UI.
 * Shows: Limit, Remaining, Reset time
 */

import { useState, useEffect } from 'react'

interface RateLimitInfo {
  limit: number | null
  remaining: number | null
  reset: number | null
  caller?: string
}

interface RateLimitStatusProps {
  /** Rate limit info from API response headers */
  rateLimit?: RateLimitInfo
  /** Endpoint name for display */
  endpoint?: string
  /** Whether to show compact version */
  compact?: boolean
  /** Custom class name */
  className?: string
}

/**
 * Format seconds until reset as human-readable string
 */
function formatResetTime(resetTimestamp: number | null): string {
  if (!resetTimestamp) return 'unknown'
  
  const now = Math.floor(Date.now() / 1000)
  const secondsUntilReset = Math.max(0, resetTimestamp - now)
  
  if (secondsUntilReset <= 0) return 'now'
  if (secondsUntilReset < 60) return `${secondsUntilReset}s`
  
  const minutes = Math.floor(secondsUntilReset / 60)
  const seconds = secondsUntilReset % 60
  return `${minutes}m ${seconds}s`
}

/**
 * Get status color based on remaining percentage
 */
function getStatusColor(remaining: number | null, limit: number | null): string {
  if (remaining === null || limit === null) return 'gray'
  
  const percentage = (remaining / limit) * 100
  
  if (percentage > 50) return 'green'
  if (percentage > 20) return 'yellow'
  return 'red'
}

export default function RateLimitStatus({ 
  rateLimit, 
  endpoint = 'API',
  compact = false,
  className = ''
}: RateLimitStatusProps) {
  const [resetTime, setResetTime] = useState<string>('--')
  
  // Update reset time every second
  useEffect(() => {
    if (!rateLimit?.reset) return
    
    const updateResetTime = () => {
      setResetTime(formatResetTime(rateLimit.reset))
    }
    
    updateResetTime()
    const interval = setInterval(updateResetTime, 1000)
    
    return () => clearInterval(interval)
  }, [rateLimit?.reset])
  
  // Don't render if no rate limit info
  if (!rateLimit || rateLimit.limit === null) {
    return null
  }
  
  const statusColor = getStatusColor(rateLimit.remaining, rateLimit.limit)
  const percentage = rateLimit.remaining !== null && rateLimit.limit !== null
    ? Math.round((rateLimit.remaining / rateLimit.limit) * 100)
    : 0
  
  const colorClasses = {
    green: 'bg-green-100 text-green-800 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200'
  }
  
  const progressColors = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  }
  
  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-2 text-xs ${className}`}>
        <span className={`px-2 py-1 rounded-full ${colorClasses[statusColor]}`}>
          {rateLimit.remaining}/{rateLimit.limit}
        </span>
        <span className="text-gray-500">resets {resetTime}</span>
      </div>
    )
  }
  
  return (
    <div className={`rounded-lg border p-3 ${colorClasses[statusColor]} ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Rate Limit</span>
          {rateLimit.caller && (
            <span className="text-xs opacity-75">({rateLimit.caller})</span>
          )}
        </div>
        <span className="text-xs opacity-75">{endpoint}</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden mb-2">
        <div 
          className={`h-full ${progressColors[statusColor]} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          <span>
            <strong>{rateLimit.remaining}</strong> / {rateLimit.limit} remaining
          </span>
        </div>
        <span>
          Resets in <strong>{resetTime}</strong>
        </span>
      </div>
    </div>
  )
}

/**
 * Hook to extract rate limit info from fetch response headers
 */
export function useRateLimitFromHeaders(headers?: {
  rateLimitLimit?: string
  rateLimitRemaining?: string
  rateLimitReset?: string
}): RateLimitInfo {
  if (!headers) {
    return { limit: null, remaining: null, reset: null }
  }
  
  return {
    limit: headers.rateLimitLimit ? parseInt(headers.rateLimitLimit, 10) : null,
    remaining: headers.rateLimitRemaining ? parseInt(headers.rateLimitRemaining, 10) : null,
    reset: headers.rateLimitReset ? parseInt(headers.rateLimitReset, 10) : null
  }
}

/**
 * Parse rate limit headers from a Response object
 */
export function parseRateLimitHeaders(response: Response): RateLimitInfo {
  return {
    limit: response.headers.get('X-RateLimit-Limit') 
      ? parseInt(response.headers.get('X-RateLimit-Limit')!, 10) 
      : null,
    remaining: response.headers.get('X-RateLimit-Remaining')
      ? parseInt(response.headers.get('X-RateLimit-Remaining')!, 10)
      : null,
    reset: response.headers.get('X-RateLimit-Reset')
      ? parseInt(response.headers.get('X-RateLimit-Reset')!, 10)
      : null
  }
}
