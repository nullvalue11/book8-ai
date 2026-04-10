import "./globals.css";
import { Providers } from "./components/Providers";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.book8.io";

export const metadata = {
  metadataBase: new URL(baseUrl),
  title: 'Book8 — Never miss a call. In any language.',
  description:
    'AI phone receptionist that answers 24/7, books appointments, and speaks 70+ languages. Stop losing customers to voicemail.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/brand/book8_ai_favicon.ico',
    shortcut: '/brand/book8_ai_favicon.ico',
    apple: '/brand/book8_ai_inverse_avatar.png',
  },
  openGraph: {
    title: 'Book8 — Never miss a call. In any language.',
    description:
      'AI phone receptionist that answers 24/7, books appointments, and speaks 70+ languages. Stop losing customers to voicemail.',
    url: baseUrl,
    siteName: 'Book8-AI',
    images: [
      {
        url: '/brand/book8_ai_social_icon.png',
        width: 1200,
        height: 630,
        alt: 'Book8 — Never miss a call. In any language.',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book8 — Never miss a call. In any language.',
    description:
      'AI phone receptionist that answers 24/7, books appointments, and speaks 70+ languages. Stop losing customers to voicemail.',
    images: ['/brand/book8_ai_social_icon.png'],
  },
  verification: {
    google: 'VTEmVdfwkSzOOMWaOgd_pIHmGDXS2NetiXdXynmfMos',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh min-h-screen text-foreground antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
