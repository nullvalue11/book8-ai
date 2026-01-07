/**
 * Ops Console Layout
 * 
 * Main navigation layout for the Ops Console.
 * Provides navigation to Tools, Logs, and Requests pages.
 */

import Link from 'next/link'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Ops Console - Book8',
  description: 'Internal operations console for Book8'
}

interface OpsLayoutProps {
  children: ReactNode
}

export default function OpsLayout({ children }: OpsLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <Link href="/ops" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">⚙️</span>
                </div>
                <span className="font-semibold text-lg">Ops Console</span>
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center space-x-1">
              <NavLink href="/ops/tools">Tools</NavLink>
              <NavLink href="/ops/logs">Logs</NavLink>
              <NavLink href="/ops/requests">Approvals</NavLink>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-gray-500 text-center">
            Book8 Internal Operations Console • Protected by Basic Auth
          </p>
        </div>
      </footer>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-slate-800 transition-colors"
    >
      {children}
    </Link>
  )
}
