const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.book8.io'

const INDUSTRY_PAGES = ['/barbershops', '/salons', '/car-wash', '/fitness', '/spas']

/** @returns {import('next').MetadataRoute.Sitemap} */
export default function sitemap() {
  const now = new Date()
  const staticPages = [
    { url: BASE_URL, priority: 1, changeFrequency: 'weekly' },
    { url: `${BASE_URL}/pricing`, priority: 0.9, changeFrequency: 'weekly' },
    { url: `${BASE_URL}/privacy`, priority: 0.3, changeFrequency: 'monthly' },
    { url: `${BASE_URL}/terms`, priority: 0.3, changeFrequency: 'monthly' }
  ]

  const industryEntries = INDUSTRY_PAGES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8
  }))

  return [
    ...staticPages.map((p) => ({
      url: p.url,
      lastModified: now,
      changeFrequency: p.changeFrequency,
      priority: p.priority
    })),
    ...industryEntries
  ]
}
