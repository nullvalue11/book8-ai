import { Metadata } from 'next'
import './globals.css'

export const metadata = {
  title: 'Book8 AI',
  description: 'AI-powered scheduling and booking platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  )
}