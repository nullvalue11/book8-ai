import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, Check } from 'lucide-react'
import { newoAlternativeCopy } from '@/copy/comparisons'

function ComparisonFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-14 px-4 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#06060f]">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-[#68668A]">
        <p>© {new Date().getFullYear()} Book8. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/pricing" className="hover:text-[#8B5CF6] transition-colors">
            Pricing
          </Link>
          <Link href="/newo-alternative" className="hover:text-[#8B5CF6] transition-colors">
            Book8 vs Newo
          </Link>
          <Link href="/migrate-from-newo" className="hover:text-[#8B5CF6] transition-colors">
            Migrate from Newo
          </Link>
          <Link href="/privacy" className="hover:text-[#8B5CF6] transition-colors">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  )
}

function CellValue({ value }) {
  const text = String(value || '')
  const yesMatch = text.match(/^yes\s*[—–-]?\s*/i)
  if (yesMatch) {
    const rest = text.slice(yesMatch[0].length).trim()
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <span>{rest || text}</span>
      </span>
    )
  }
  return text
}

export default function NewoAlternativePage() {
  const content = newoAlternativeCopy

  return (
    <>
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
          <div className="relative z-10 mx-auto max-w-3xl">
            <p className="text-sm text-slate-500 dark:text-[#68668A] text-center mb-4">
              Last updated {content.lastUpdated} · Written by the Book8 founder · No affiliate links
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white text-center">
              {content.hero.headline}
            </h1>
            <blockquote className="mt-8 rounded-xl border border-slate-200 bg-white/80 p-5 text-slate-700 dark:border-[rgba(139,92,246,0.15)] dark:bg-[#121228]/60 dark:text-[#9593A8] text-sm md:text-base leading-relaxed">
              <strong className="text-slate-900 dark:text-white">Short version: </strong>
              {content.shortVersion}
            </blockquote>
            <nav
              className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-[#8B5CF6] dark:text-[#A78BFA]"
              aria-label="On this page"
            >
              {content.jumpLinks.map((link, i) => (
                <span key={link.href} className="inline-flex items-center gap-4">
                  {i > 0 ? <span className="text-slate-300 dark:text-[#68668A]" aria-hidden>·</span> : null}
                  <a href={link.href} className="hover:underline">
                    {link.label}
                  </a>
                </span>
              ))}
            </nav>
          </div>
        </section>

        <section
          id="table"
          className="py-12 md:py-16 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)] scroll-mt-24"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              {content.comparisonSectionTitle}
            </h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-2xl border border-slate-200 dark:border-[rgba(139,92,246,0.15)] shadow-sm">
              <table className="w-full min-w-[720px] border-collapse text-sm md:text-base">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]">
                    <th scope="col" className="px-4 py-3 text-start font-semibold w-[28%]" />
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold text-[#7C3AED] dark:text-[#A78BFA] w-[36%]"
                    >
                      {content.comparisonTable.headers[1]}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold text-slate-700 dark:text-[#9593A8] w-[36%]"
                    >
                      {content.comparisonTable.headers[2]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {content.comparisonTable.rows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-slate-100 last:border-0 dark:border-[rgba(139,92,246,0.08)] odd:bg-white even:bg-slate-50/80 dark:odd:bg-[#0b0b1a] dark:even:bg-[#121228]/50"
                    >
                      <th
                        scope="row"
                        className="px-4 py-3.5 text-start font-medium text-slate-900 dark:text-white align-top"
                      >
                        {row.label}
                      </th>
                      <td className="px-4 py-3.5 text-slate-800 dark:text-[#EEEDF5] align-top">
                        <CellValue value={row.book8} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-[#9593A8] align-top">
                        {row.newo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-[#68668A]">
              Sources for Newo numbers:{' '}
              {content.sources.map((s, i) => (
                <span key={s.href}>
                  {i > 0 ? ', ' : ''}
                  <a
                    href={s.href}
                    className="text-[#8B5CF6] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.label}
                  </a>
                </span>
              ))}
              .
            </p>
          </div>
        </section>

        <section className="py-10 px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]/50">
            <p className="text-slate-800 dark:text-[#EEEDF5]">
              <strong>{content.migrationBanner.title}</strong> {content.migrationBanner.body}{' '}
              <Link href={content.migrationBanner.href} className="text-[#8B5CF6] font-medium hover:underline">
                {content.migrationBanner.ctaLabel}
              </Link>
            </p>
          </div>
        </section>

        <section
          id="wedges"
          className="py-16 md:py-20 px-4 bg-slate-100/80 dark:bg-[#0b0b1a]/50 scroll-mt-24"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
              {content.reasonsSectionTitle}
            </h2>
            <ol className="space-y-12 list-none p-0 m-0">
              {content.reasons.map((item, index) => (
                <li key={item.title}>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    <span className="text-[#8B5CF6] dark:text-[#A78BFA] me-2">{index + 1}.</span>
                    {item.title}
                  </h3>
                  <p className="mt-3 text-slate-600 dark:text-[#9593A8] leading-relaxed whitespace-pre-line">
                    {item.body}
                  </p>
                  {item.sources ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-[#68668A]">
                      Sources:{' '}
                      {item.sources.map((s, i) => (
                        <span key={s.href}>
                          {i > 0 ? ', ' : ''}
                          <a
                            href={s.href}
                            className="text-[#8B5CF6] hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.label}
                          </a>
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {item.verticalLinks ? (
                    <ul className="mt-4 space-y-2 list-disc ps-5 text-sm text-[#8B5CF6] dark:text-[#A78BFA]">
                      {item.verticalLinks.map((v) => (
                        <li key={v.href}>
                          <Link href={v.href} className="hover:underline">
                            {v.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="newo-wins"
          className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)] scroll-mt-24"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {content.whenCompetitorSectionTitle}
            </h2>
            <p className="text-slate-600 dark:text-[#9593A8] leading-relaxed mb-6">{content.whenCompetitorIntro}</p>
            <ul className="space-y-4 list-disc ps-5 text-slate-600 dark:text-[#9593A8] leading-relaxed">
              {content.whenCompetitorBullets.map((bullet) => (
                <li key={bullet.slice(0, 56)}>{bullet}</li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="faq"
          className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)] scroll-mt-24"
        >
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              Frequently asked questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {content.faq.map((item) => (
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
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              {content.finalCta.headline}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href={content.finalCta.primary.href}
                className="block rounded-xl border border-slate-200 bg-white p-6 hover:border-[#8B5CF6]/40 transition-colors dark:border-[rgba(139,92,246,0.15)] dark:bg-[#121228]"
              >
                <strong className="text-slate-900 dark:text-white">{content.finalCta.primary.label}</strong>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#9593A8]">{content.finalCta.primary.sub}</p>
              </Link>
              <a
                href={content.finalCta.secondary.href}
                className="block rounded-xl border border-slate-200 bg-white p-6 hover:border-[#8B5CF6]/40 transition-colors dark:border-[rgba(139,92,246,0.15)] dark:bg-[#121228]"
              >
                <strong className="text-slate-900 dark:text-white">{content.finalCta.secondary.label}</strong>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#9593A8]">{content.finalCta.secondary.sub}</p>
              </a>
            </div>
            <p className="mt-10 text-xs text-slate-500 dark:text-[#68668A] text-center max-w-2xl mx-auto">
              {content.disclaimer} Found an inaccuracy? Email{' '}
              <a href={`mailto:${content.correctionEmail}`} className="text-[#8B5CF6] hover:underline">
                {content.correctionEmail}
              </a>{' '}
              and we will correct it within 48 hours.
            </p>
          </div>
        </section>
      </main>
      <ComparisonFooter />
    </>
  )
}
