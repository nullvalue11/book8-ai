import NewoAlternativePage from '@/components/NewoAlternativePage'
import { newoAlternativeCopy, newoAlternativeSchema } from '@/copy/comparisons'

export const metadata = {
  title: newoAlternativeCopy.meta.title,
  description: newoAlternativeCopy.meta.description,
  alternates: { canonical: newoAlternativeCopy.meta.canonical },
  openGraph: {
    title: newoAlternativeCopy.meta.title,
    description: newoAlternativeCopy.meta.description,
    url: 'https://www.book8.io/newo-alternative',
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

export default function NewoAlternativeRoutePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newoAlternativeSchema) }}
      />
      <NewoAlternativePage />
    </>
  )
}
