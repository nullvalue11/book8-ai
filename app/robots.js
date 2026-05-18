/** @returns {import('next').MetadataRoute.Robots} */
export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/setup/', '/dashboard/', '/b/']
      }
    ],
    sitemap: 'https://www.book8.io/sitemap.xml',
    host: 'https://www.book8.io'
  }
}
