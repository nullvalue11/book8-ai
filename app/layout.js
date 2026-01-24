import "./globals.css";
import { ThemeProvider } from "next-themes";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://book8-ai.vercel.app";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Book8 AI',
  description: 'Intelligent booking & automation',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/brand/book8_ai_favicon.ico',
    shortcut: '/brand/book8_ai_favicon.ico',
    apple: '/brand/book8_ai_inverse_avatar.png',
  },
  openGraph: {
    title: 'Book8 AI',
    description: 'Intelligent booking & automation',
    url: baseUrl,
    siteName: 'Book8 AI',
    images: [{ url: '/brand/book8_ai_social_icon.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book8 AI',
    description: 'Intelligent booking & automation',
    images: ['/brand/book8_ai_social_icon.png'],
  },
  verification: {
    google: 'VTEmVdfwkSzOOhH1--KcCwxw-vVF0uJ_HPDvmvSsqC4',
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
