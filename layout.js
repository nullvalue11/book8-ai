import './globals.css'

export const metadata = {
  title: 'Book8 AI',
  description: 'Book, modify, and cancel appointments with AI-ready integrations.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}