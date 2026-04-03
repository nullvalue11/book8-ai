import "./globals.css";
import { Providers } from "./components/Providers";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.book8.io";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Book8-AI — AI Receptionist for Businesses | 70+ Languages',
  description:
    'AI-powered phone receptionist that answers calls, books appointments, and speaks 70+ languages. Voice AI, SMS booking, and online scheduling for any service business. Try free for 14 days.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/brand/book8_ai_favicon.ico',
    shortcut: '/brand/book8_ai_favicon.ico',
    apple: '/brand/book8_ai_inverse_avatar.png',
  },
  openGraph: {
    title: 'Book8-AI — Your AI Receptionist. Always On. Always Booking.',
    description:
      'AI receptionist that answers calls in 70+ languages, books appointments, and sends confirmations. Built for barbers, clinics, studios, and any service business.',
    url: baseUrl,
    siteName: 'Book8-AI',
    images: [{ url: '/brand/book8_ai_social_icon.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book8-AI — Your AI Receptionist. Always On. Always Booking.',
    description:
      'AI receptionist that answers calls in 70+ languages, books appointments, and sends confirmations. Built for service businesses worldwide.',
    images: ['/brand/book8_ai_social_icon.png'],
  },
  verification: {
    google: 'VTEmVdfwkSzOOMWaOgd_pIHmGDXS2NetiXdXynmfMos',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
