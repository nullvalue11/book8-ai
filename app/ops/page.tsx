/**
 * Ops Console Home Page
 * 
 * Dashboard overview with quick links to main sections.
 */

import Link from 'next/link'

export default function OpsHomePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Ops Control Plane</h1>
        <p className="mt-2 text-gray-600">
          Internal operations console for managing tools, viewing logs, and handling approvals.
        </p>
      </div>
      
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickLinkCard
          href="/ops/tools"
          title="Tools Registry"
          description="Browse registered ops tools, view schemas, and see usage examples."
          icon="🛠️"
          color="blue"
        />
        <QuickLinkCard
          href="/ops/logs"
          title="Execution Logs"
          description="View execution history, filter by tool/status, and debug issues."
          icon="📋"
          color="green"
        />
        <QuickLinkCard
          href="/ops/requests"
          title="Pending Approvals"
          description="Review and approve high-risk operations requiring human oversight."
          icon="✅"
          color="amber"
        />
      </div>
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900">📖 How it works</h3>
        <ul className="mt-2 text-sm text-blue-800 space-y-1">
          <li>• <strong>Tools</strong> are registered operations that can be executed via the API</li>
          <li>• <strong>Logs</strong> track all tool executions with full input/output capture</li>
          <li>• <strong>Approvals</strong> are required for high-risk tools (marked with requiresApproval=true)</li>
          <li>• All API calls go through <code className="bg-blue-100 px-1 rounded">/api/ops/*</code> proxy</li>
        </ul>
      </div>
    </div>
  )
}

function QuickLinkCard({
  href,
  title,
  description,
  icon,
  color
}: {
  href: string
  title: string
  description: string
  icon: string
  color: 'blue' | 'green' | 'amber'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    green: 'bg-green-50 border-green-200 hover:bg-green-100',
    amber: 'bg-amber-50 border-amber-200 hover:bg-amber-100'
  }
  
  return (
    <Link
      href={href}
      className={`block p-6 rounded-lg border transition-colors ${colorClasses[color]}`}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
    </Link>
  )
}
