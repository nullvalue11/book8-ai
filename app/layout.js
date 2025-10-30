import "./globals.css";
import { ThemeProvider } from "next-themes";

export const metadata = {
  title: 'Book8 AI',
  description: 'Intelligent booking & automation',
  icons: {
    icon: '/book8_ai_favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Book8 AI',
    description: 'Intelligent booking & automation',
    url: process.env.NEXT_PUBLIC_BASE_URL,
    siteName: 'Book8 AI',
    images: [{ url: '/book8_ai_social_icon.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book8 AI',
    description: 'Intelligent booking & automation',
    images: ['/book8_ai_social_icon.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
