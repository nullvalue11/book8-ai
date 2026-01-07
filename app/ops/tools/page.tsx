/**
 * Tools Registry Page
 * 
 * Lists all registered ops tools with their schemas and examples.
 */

import { opsGet } from '@/app/api/ops/_lib/opsFetch'

export const dynamic = 'force-dynamic'

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

export default async function ToolsPage() {
  const result = await opsGet<{ ok: boolean; tools: Tool[] }>('/api/internal/ops/tools', {
    format: 'full',
    includeDeprecated: 'false'
  })
  
  const tools = result.data?.tools || []
  
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tools Registry</h1>
        <p className="mt-1 text-gray-600">
          {tools.length} registered tools across {Object.keys(byCategory).length} categories
        </p>
      </div>
      
      {/* Error State */}
      {!result.ok && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load tools: {result.error}</p>
        </div>
      )}
      
      {/* Tools by Category */}
      {Object.entries(byCategory).map(([category, categoryTools]) => (
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
              ⚠️ {tool.deprecatedReason}
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
