'use client'

/**
 * Tools Registry Page
 * 
 * Lists all registered ops tools with their schemas and examples.
 * Client component to support rate limit display.
 */

import { useState, useEffect } from 'react'
import RateLimitStatus, { parseRateLimitHeaders } from '../_components/RateLimitStatus'

interface Tool {
  name: string
  description: string
  category: string
  mutates: boolean
  risk: 'low' | 'medium' | 'high'
  dryRunSupported: boolean
  requiresApproval: boolean
  deprecated: boolean
  deprecatedReason?: string
  replacedBy?: string
  inputSchema?: any
  outputSchema?: any
  examples?: Array<{ name: string; input: any; description: string }>
}

interface ToolsResponse {
  ok: boolean
  tools: Tool[]
  error?: string
}

interface RateLimitInfo {
  limit: number | null
  remaining: number | null
  reset: number | null
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo>({ limit: null, remaining: null, reset: null })
  
  // Fetch tools from proxy API
  const fetchTools = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/ops/tools?format=full&includeDeprecated=false')
      
      // Extract rate limit headers
      setRateLimit(parseRateLimitHeaders(response))
      
      const data: ToolsResponse = await response.json()
      
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to fetch tools')
      }
      
      setTools(data.tools || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchTools()
  }, [])
  
  // Group by category
  const byCategory = tools.reduce((acc, tool) => {
    const cat = tool.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tool)
    return acc
  }, {} as Record<string, Tool[]>)
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tools Registry</h1>
          <p className="mt-1 text-gray-600">
            {tools.length} registered tools across {Object.keys(byCategory).length} categories
          </p>
        </div>
        <button
          onClick={fetchTools}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      {/* Rate Limit Status */}
      <RateLimitStatus rateLimit={rateLimit} endpoint="/api/ops/tools" />
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load tools: {error}</p>
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-2 text-gray-600">Loading tools...</p>
        </div>
      )}
      
      {/* Tools by Category */}
      {!loading && Object.entries(byCategory).map(([category, categoryTools]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 capitalize border-b pb-2">
            {category} ({categoryTools.length})
          </h2>
          
          <div className="space-y-4">
            {categoryTools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </div>
      ))}
      
      {/* Empty State */}
      {!loading && tools.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No tools found</p>
        </div>
      )}
    </div>
  )
}

function ToolCard({ tool }: { tool: Tool }) {
  const riskColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  }
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <code className="font-mono font-semibold text-blue-600">{tool.name}</code>
          
          {/* Badges */}
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 text-xs rounded-full ${riskColors[tool.risk]}`}>
              {tool.risk} risk
            </span>
            
            {tool.mutates && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                mutates
              </span>
            )}
            
            {tool.requiresApproval && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800">
                requires approval
              </span>
            )}
            
            {tool.deprecated && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">
                deprecated
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4 space-y-4">
        <p className="text-gray-700">{tool.description}</p>
        
        {/* Deprecation Warning */}
        {tool.deprecated && tool.deprecatedReason && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
            <p className="text-yellow-800">
              {tool.deprecatedReason}
              {tool.replacedBy && (
                <span> Use <code className="font-mono">{tool.replacedBy}</code> instead.</span>
              )}
            </p>
          </div>
        )}
        
        {/* Input Schema */}
        {tool.inputSchema && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">Input Schema</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Examples */}
        {tool.examples && tool.examples.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Examples</h4>
            <div className="space-y-2">
              {tool.examples.map((example, i) => (
                <div key={i} className="bg-gray-50 rounded p-2">
                  <p className="text-sm font-medium text-gray-800">{example.name}</p>
                  <p className="text-xs text-gray-600 mb-1">{example.description}</p>
                  <pre className="text-xs bg-white p-2 rounded border">
                    {JSON.stringify(example.input, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
