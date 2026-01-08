'use client'

/**
 * Approval Requests Page
 * 
 * List and manage pending approval requests.
 * Allows approving or rejecting high-risk operations.
 */

import { useState, useEffect } from 'react'
import RateLimitStatus, { parseRateLimitHeaders } from '../_components/RateLimitStatus'

interface RateLimitInfo {
  limit: number | null
  remaining: number | null
  reset: number | null
}

interface ApprovalRequest {
  requestId: string
  tool: string
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'expired'
  payload: any
  plan?: any
  requestedBy: string
  approvedBy?: string
  approvedAt?: string
  executedAt?: string
  expiresAt: string
  createdAt: string
}

interface RequestsResponse {
  ok: boolean
  requests: ApprovalRequest[]
  error?: string
  pagination: {
    total: number
    limit: number
    skip: number
  }
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({ limit: null, remaining: null, reset: null })
  
  // Fetch requests
  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit', '50')
      
      const response = await fetch(`/api/ops/requests?${params.toString()}`)
      const data: RequestsResponse = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch requests')
      }
      
      setRequests(data.requests || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchRequests()
  }, [statusFilter])
  
  // Approve request
  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/ops/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'console-user' })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }
      
      await fetchRequests()
    } catch (err: any) {
      alert(`Approve failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }
  
  // Execute approved request
  const handleExecute = async (requestId: string) => {
    setActionLoading(requestId)
    try {
      const response = await fetch(`/api/ops/requests/${requestId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executedBy: 'console-user' })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to execute')
      }
      
      await fetchRequests()
    } catch (err: any) {
      alert(`Execute failed: ${err.message}`)
    } finally {
      setActionLoading(null)
    }
  }
  
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    executed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800'
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Requests</h1>
          <p className="mt-1 text-gray-600">
            Manage high-risk operations requiring human approval
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <div className="flex space-x-2">
            {['pending', 'approved', 'executed', 'all'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status === 'all' ? '' : status)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  (status === 'all' && !statusFilter) || statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading requests...</p>
        </div>
      )}
      
      {/* Requests List */}
      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.requestId} className="bg-white rounded-lg border overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <code className="text-sm font-mono text-blue-600">{req.tool}</code>
                  <span className={`px-2 py-1 text-xs rounded-full ${statusColors[req.status]}`}>
                    {req.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(req.createdAt).toLocaleString()}
                </div>
              </div>
              
              {/* Body */}
              <div className="p-4 space-y-3">
                {/* Request ID */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Request ID:</span>
                  <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {req.requestId}
                  </code>
                </div>
                
                {/* Requested By */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Requested by:</span>
                  <span className="text-sm">{req.requestedBy}</span>
                </div>
                
                {/* Expires */}
                {req.status === 'pending' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Expires:</span>
                    <span className="text-sm text-orange-600">
                      {new Date(req.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}
                
                {/* Payload */}
                <div>
                  <span className="text-sm text-gray-500">Payload:</span>
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(req.payload, null, 2)}
                  </pre>
                </div>
                
                {/* Plan (if available) */}
                {req.plan && (
                  <div>
                    <span className="text-sm text-gray-500">Plan:</span>
                    <pre className="mt-1 text-xs bg-blue-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(req.plan, null, 2)}
                    </pre>
                  </div>
                )}
                
                {/* Actions */}
                {(req.status === 'pending' || req.status === 'approved') && (
                  <div className="flex items-center space-x-3 pt-3 border-t">
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(req.requestId)}
                        disabled={actionLoading === req.requestId}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === req.requestId ? 'Approving...' : '✓ Approve'}
                      </button>
                    )}
                    
                    {req.status === 'approved' && (
                      <button
                        onClick={() => handleExecute(req.requestId)}
                        disabled={actionLoading === req.requestId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === req.requestId ? 'Executing...' : '▶ Execute'}
                      </button>
                    )}
                  </div>
                )}
                
                {/* Execution Info */}
                {req.status === 'executed' && req.executedAt && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-green-600">
                      ✓ Executed at {new Date(req.executedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {!loading && requests.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No {statusFilter || ''} requests found</p>
          <p className="text-sm text-gray-400 mt-1">High-risk operations will appear here for approval</p>
        </div>
      )}
    </div>
  )
}
