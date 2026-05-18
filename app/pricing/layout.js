import JsonLd from '@/components/JsonLd'
import { pricingFaqSchema } from '@/lib/schemas'

export const metadata = {
  title: 'Pricing — Book8 | AI Receptionist Plans Starting at $19/mo',
  description:
    'Simple, transparent pricing for Book8 AI receptionist. Plans from $19/mo with 14-day free trial. Multilingual, 24/7 call answering for service businesses.',
  alternates: {
    canonical: '/pricing'
  },
  openGraph: {
    title: 'Pricing — Book8 | AI Receptionist Plans Starting at $19/mo',
    description:
      'Simple, transparent pricing for Book8 AI receptionist. Plans from $19/mo with 14-day free trial. Multilingual, 24/7 call answering for service businesses.',
    images: [
      {
        url: '/brand/book8_og_social.png',
        width: 1200,
        height: 630,
        alt: 'Book8 AI — Answers calls in 70+ languages. Books appointments 24/7.'
      }
    ]
  }
}

export default function PricingLayout({ children }) {
  return (
    <>
      <JsonLd data={pricingFaqSchema} />
      {children}
    </>
  )
}
