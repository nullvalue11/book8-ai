import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, Check, Mail } from 'lucide-react'
import { migrateFromNewoCopy } from '@/copy/migrate-from-newo'

const SITE_URL = 'https://www.book8.io'
const c = migrateFromNewoCopy

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/migrate-from-newo#webpage`,
      url: `${SITE_URL}/migrate-from-newo`,
      name: c.meta.title,
      description: c.meta.description,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      about: { '@id': `${SITE_URL}/#organization` }
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Book8',
      legalName: '11111221 Canada INC.',
      url: SITE_URL,
      logo: `${SITE_URL}/brand/book8_ai_social_icon.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'wais@book8.io',
        availableLanguage: ['English', 'French', 'Arabic']
      }
    },
    {
      '@type': 'Service',
      name: 'Newo to Book8 migration',
      description:
        'Free migration of business profile, services, calendar, and phone routing from Newo.ai to Book8, plus 30 days on Book8 Growth at no charge.',
      provider: { '@id': `${SITE_URL}/#organization` },
      areaServed: ['CA', 'US', 'AE', 'SA', 'EG', 'IN', 'BR', 'MX'],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: '30 days Book8 Growth + free migration setup',
        url: `${SITE_URL}/migrate-from-newo`
      }
    },
    {
      '@type': 'FAQPage',
      mainEntity: c.faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer }
      }))
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Migrate from Newo', item: `${SITE_URL}/migrate-from-newo` }
      ]
    }
  ]
}

export const metadata = {
  title: c.meta.title,
  description: c.meta.description,
  alternates: { canonical: c.meta.canonical },
  openGraph: {
    title: c.meta.title,
    description: c.meta.description,
    url: `${SITE_URL}/migrate-from-newo`,
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

function MigrateFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-14 px-4 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#06060f]">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-[#68668A]">
        <p>© {new Date().getFullYear()} Book8. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/newo-alternative" className="hover:text-[#8B5CF6] transition-colors">
            Book8 vs Newo
          </Link>
          <Link href="/pricing" className="hover:text-[#8B5CF6] transition-colors">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-[#8B5CF6] transition-colors">
            Privacy
          </Link>
        </div>
      </div>
      <p className="mx-auto max-w-3xl mt-6 text-center text-xs text-slate-500 dark:text-[#68668A]">
        Found an inaccuracy on this page? Email{' '}
        <a href="mailto:wais@book8.io" className="text-[#8B5CF6] hover:underline">
          wais@book8.io
        </a>{' '}
        and we will correct it within 48 hours.
      </p>
    </footer>
  )
}

export default function MigrateFromNewoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Header variant="landing" />
      <main
        id="main-content"
        className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-[#06060f] dark:via-[#0b0b1a] dark:to-[#06060f] text-slate-900 dark:text-[#EEEDF5]"
      >
        <section className="relative isolate overflow-hidden pt-28 pb-12 md:pt-32 md:pb-16 px-4">
          <div
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-60"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.25), transparent)'
            }}
          />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8B5CF6] mb-4">
              Newo → Book8
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {c.hero.headline}
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-[#9593A8] leading-relaxed">
              {c.hero.subheadline}
            </p>
            <ul className="mt-8 text-start max-w-lg mx-auto space-y-2 text-sm text-slate-700 dark:text-[#9593A8]">
              {c.offerBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" aria-hidden />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`mailto:${c.ctaEmail}?subject=Newo%20migration%20to%20Book8`}>
                <Button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
                  <Mail className="w-4 h-4 me-2 inline" aria-hidden />
                  Email to start migration
                </Button>
              </a>
              <Link href={c.setupHref} className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-12 px-8 rounded-xl border-slate-300 dark:border-[rgba(139,92,246,0.3)]"
                >
                  Or start trial yourself
                  <ArrowRight className="w-4 h-4 ms-2 inline" aria-hidden />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-14 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">{c.includedTitle}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
              {c.included.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white/90 p-5 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]/80"
                >
                  <h3 className="font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-[#9593A8] leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-14 px-4 bg-slate-100/80 dark:bg-[#0b0b1a]/50">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">{c.stepsTitle}</h2>
            <ol className="space-y-6 list-none p-0 m-0">
              {c.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-[#9593A8] leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-14 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#8B5CF6]/30 bg-[rgba(139,92,246,0.06)] p-6 text-center dark:bg-[rgba(139,92,246,0.08)]">
            <p className="text-slate-700 dark:text-[#EEEDF5]">
              Not sure Book8 is the right fit? Read our{' '}
              <Link href="/newo-alternative" className="text-[#8B5CF6] font-medium hover:underline">
                honest Book8 vs Newo comparison
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="py-14 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">
              Migration FAQ
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {c.faq.map((item) => (
                <AccordionItem
                  key={item.question}
                  value={item.question}
                  className="border-slate-200 dark:border-[rgba(139,92,246,0.12)]"
                >
                  <AccordionTrigger className="text-start hover:no-underline text-slate-900 dark:text-white">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 dark:text-[#9593A8] leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="py-16 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to switch?</h2>
            <p className="mt-3 text-slate-600 dark:text-[#9593A8]">
              Email {c.ctaEmail} with your business name and Newo account — we will reply within one business day.
            </p>
            <a
              href={`mailto:${c.ctaEmail}?subject=Newo%20migration%20to%20Book8`}
              className="inline-flex mt-6"
            >
              <Button className="h-12 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
                <Mail className="w-4 h-4 me-2" aria-hidden />
                wais@book8.io
              </Button>
            </a>
          </div>
        </section>
      </main>
      <MigrateFooter />
    </>
  )
}
