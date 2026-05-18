import { homepageByLocale } from '@/lib/marketing-homepage-strings'
import { PRICES } from '@/lib/pricing-display-currencies'

const SITE_URL = 'https://www.book8.io'
const ORG_LEGAL_NAME = '11111221 Canada INC.'
const ORG_NAME = 'Book8'
const ORG_DESCRIPTION =
  'AI phone receptionist that answers calls 24/7, books appointments, and speaks 70+ languages — built for service businesses.'

const USD = PRICES.USD

/** @param {Record<string, unknown>} obj */
function stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export const organizationSchema = stripUndefined({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: ORG_NAME,
  alternateName: 'Book8 AI',
  legalName: ORG_LEGAL_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/book8_ai_social_icon.png`,
  description: ORG_DESCRIPTION,
  sameAs: ['https://www.instagram.com/book8.ai/', 'https://www.tiktok.com/@book8.ai'],
  foundingDate: '2025',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'CA'
  }
})

export const websiteSchema = stripUndefined({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Book8 AI',
  url: SITE_URL,
  description: ORG_DESCRIPTION,
  inLanguage: ['en', 'fr', 'es', 'ar']
})

export const softwareApplicationSchema = stripUndefined({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Book8 AI Receptionist',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  description: ORG_DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: String(USD.starter.amount),
    priceCurrency: USD.starter.code,
    priceValidUntil: '2026-12-31'
  },
  featureList: [
    'Answers calls 24/7',
    'Multilingual support — 70+ languages',
    'SMS confirmations and reminders',
    'Google Calendar integration',
    'WhatsApp booking',
    'Per-staff availability',
    'Cancellation and rescheduling'
  ]
})

export const serviceSchema = stripUndefined({
  '@context': 'https://schema.org',
  '@type': 'Service',
  serviceType: 'AI Phone Receptionist',
  name: 'Book8 AI Receptionist',
  description: ORG_DESCRIPTION,
  provider: {
    '@type': 'Organization',
    name: ORG_NAME,
    url: SITE_URL
  },
  areaServed: {
    '@type': 'Place',
    name: 'Worldwide'
  },
  audience: {
    '@type': 'BusinessAudience',
    audienceType:
      'Service businesses — barbershops, salons, spas, fitness studios, car washes, pet groomers, auto repair shops, nail salons, cleaning services, tattoo studios'
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Book8 Plans',
    itemListElement: [
      {
        '@type': 'Offer',
        name: 'Starter',
        description: 'AI phone receptionist for solo operators and very small businesses.',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(USD.starter.amount),
          priceCurrency: USD.starter.code,
          unitText: 'MONTH',
          billingDuration: 'P1M'
        }
      },
      {
        '@type': 'Offer',
        name: 'Growth',
        description: 'Multi-location AI phone receptionist for growing service businesses.',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(USD.growth.amount),
          priceCurrency: USD.growth.code,
          unitText: 'MONTH',
          billingDuration: 'P1M'
        }
      },
      {
        '@type': 'Offer',
        name: 'Enterprise',
        description:
          'AI phone receptionist with custom integrations, priority support, and dedicated success.',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(USD.enterprise.amount),
          priceCurrency: USD.enterprise.code,
          unitText: 'MONTH',
          billingDuration: 'P1M'
        }
      }
    ]
  }
})

/** English pricing FAQs — must match visible copy on /pricing (default locale). */
export const pricingFaqsEn = homepageByLocale.en.faq.map(({ q, a }) => ({
  question: q,
  answer: a
}))

/**
 * @param {{ question: string, answer: string }[]} faqs
 */
export function buildFAQSchema(faqs) {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  })
}

export const pricingFaqSchema = buildFAQSchema(pricingFaqsEn)

/**
 * @param {{ name: string, url?: string }[]} items
 */
/**
 * @param {{
 *   headline: string,
 *   description: string,
 *   path: string,
 *   datePublished: string,
 *   dateModified: string
 * }} params
 */
export function buildArticleSchema({ headline, description, path, datePublished, dateModified }) {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    author: {
      '@type': 'Organization',
      name: 'Book8',
      url: SITE_URL
    },
    publisher: {
      '@type': 'Organization',
      name: 'Book8',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/brand/book8_ai_social_icon.png`
      }
    },
    datePublished,
    dateModified,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}${path}`
    }
  })
}

export function buildBreadcrumbSchema(items) {
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) =>
      stripUndefined({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        ...(item.url ? { item: `${SITE_URL}${item.url}` } : {})
      })
    )
  })
}
