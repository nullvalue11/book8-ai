import './globals.css'

export const metadata = {
  title: 'Book8 AI',
  description: 'Book, modify, and cancel appointments with AI-ready integrations.',
}

export default function RootLayout({ children }) {
  return (
    &lt;html lang="en"&gt;
      &lt;body className="min-h-screen bg-background text-foreground"&gt;
        {children}
      &lt;/body&gt;
    &lt;/html&gt;
  )
}