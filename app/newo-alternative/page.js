import NewoAlternativePage from '@/components/NewoAlternativePage'
import JsonLd from '@/components/JsonLd'
import { newoAlternativeCopy } from '@/copy/comparisons'
import { buildArticleSchema, buildBreadcrumbSchema, buildFAQSchema } from '@/lib/schemas'

const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: '/' },
  { name: newoAlternativeCopy.breadcrumbLabel, url: `/${newoAlternativeCopy.slug}` }
])

const articleSchema = buildArticleSchema({
  headline: 'Book8 vs Newo: The Best Newo.ai Alternative for Service Businesses',
  description: newoAlternativeCopy.meta.description,
  path: `/${newoAlternativeCopy.slug}`,
  datePublished: '2026-05-18',
  dateModified: '2026-05-18'
})

const faqSchema = buildFAQSchema(
  newoAlternativeCopy.faq.map((item) => ({
    question: item.question,
    answer: item.answer
  }))
)

export const metadata = {
  title: newoAlternativeCopy.meta.title,
  description: newoAlternativeCopy.meta.description,
  alternates: { canonical: newoAlternativeCopy.meta.canonical },
  openGraph: {
    title: newoAlternativeCopy.meta.title,
    description: newoAlternativeCopy.meta.description,
    url: 'https://www.book8.io/newo-alternative'
  }
}

export default function NewoAlternativeRoutePage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <NewoAlternativePage />
    </>
  )
}
