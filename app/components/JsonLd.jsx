/**
 * Renders JSON-LD for search engines (Organization, FAQPage, etc.).
 * @param {{ data?: Record<string, unknown> | null }} props
 */
export default function JsonLd({ data }) {
  if (!data) return null
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
