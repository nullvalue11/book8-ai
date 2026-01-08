'use client'

/**
 * Execution Logs Page
 * 
 * Browse execution logs with filtering by tool, status, and date.
 */

import { useState, useEffect } from 'react'
import RateLimitStatus, { parseRateLimitHeaders } from '../_components/RateLimitStatus'

interface Log {
  requestId: string
  tool: string
  businessId?: string
  status: 'success' | 'failed' | 'partial'
  durationMs: number
  executedAt: string
  actor: string
  mode?: string
}

interface LogsResponse {
  ok: boolean
  logs: Log[]
  pagination: {
    total: number
    limit: number
    skip: number
  }
}

interface RateLimitInfo {
  limit: number | null
  remaining: number | null
  reset: number | null
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ total: 0, limit: 50, skip: 0 })
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({ limit: null, remaining: null, reset: null })
  
  // Filters
  const [toolFilter, setToolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sinceFilter, setSinceFilter] = useState('')
  
  // Fetch logs
  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (toolFilter) params.set('tool', toolFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (sinceFilter) params.set('since', sinceFilter)
      params.set('limit', '50')
      params.set('skip', String(pagination.skip))
      
      const response = await fetch(`/api/ops/logs?${params.toString()}`)
      
      // Extract rate limit headers
      setRateLimit(parseRateLimitHeaders(response))
      
      const data: LogsResponse = await response.json()
      
      if (!data.ok) {
        throw new Error(data.ok === false ? 'Failed to fetch logs' : 'Unknown error')
      }
      
      setLogs(data.logs || [])
      setPagination(data.pagination || { total: 0, limit: 50, skip: 0 })
    } catch (err: any) {
      setError(err.message || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchLogs()
  }, [toolFilter, statusFilter, sinceFilter, pagination.skip])
  
  const statusColors = {
    success: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    partial: 'bg-yellow-100 text-yellow-800'
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Execution Logs</h1>
          <p className="mt-1 text-gray-600">
            {pagination.total} total executions
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tool</label>
            <input
              type="text"
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              placeholder="e.g., tenant.bootstrap"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Since</label>
            <select
              value={sinceFilter}
              onChange={(e) => setSinceFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All time</option>
              <option value={new Date(Date.now() - 3600000).toISOString()}>Last hour</option>
              <option value={new Date(Date.now() - 86400000).toISOString()}>Last 24 hours</option>
              <option value={new Date(Date.now() - 604800000).toISOString()}>Last 7 days</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setToolFilter('')
                setStatusFilter('')
                setSinceFilter('')
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Clear filters
            </button>
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
          <p className="mt-2 text-gray-600">Loading logs...</p>
        </div>
      )}
      
      {/* Logs Table */}
      {!loading && logs.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tool</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.requestId} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-gray-600">
                      {log.requestId.substring(0, 20)}...
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-blue-600">{log.tool}</code>
                    {log.mode === 'plan' && (
                      <span className="ml-2 text-xs text-gray-500">(plan)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[log.status] || 'bg-gray-100'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.durationMs}ms
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.actor}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(log.executedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Empty State */}
      {!loading && logs.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No logs found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      )}
      
      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {pagination.skip + 1} - {Math.min(pagination.skip + pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination(p => ({ ...p, skip: Math.max(0, p.skip - p.limit) }))}
              disabled={pagination.skip === 0}
              className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(p => ({ ...p, skip: p.skip + p.limit }))}
              disabled={pagination.skip + pagination.limit >= pagination.total}
              className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
