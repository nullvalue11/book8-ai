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
          <Link href="/privacy" className="hover:text-[#8B5CF6] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#8B5CF6] transition-colors">
            Terms
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
        {/* Hero */}
        <section className="relative isolate overflow-hidden pt-28 pb-16 md:pt-32 md:pb-20 px-4">
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
              Comparison
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {content.hero.headline}
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-[#9593A8] leading-relaxed">
              {content.hero.subheadline}
            </p>
            <div className="mt-8 flex flex-col items-center gap-2">
              <Link href={content.setupHref} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-base font-semibold shadow-[0_0_28px_-8px_rgba(139,92,246,0.7)]">
                  {content.hero.primaryCtaLabel}
                  <ArrowRight className="w-4 h-4 ms-2 inline" aria-hidden />
                </Button>
              </Link>
              <p className="text-sm text-slate-500 dark:text-[#68668A]">{content.hero.primaryCtaHint}</p>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              {content.comparisonSectionTitle}
            </h2>
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-2xl border border-slate-200 dark:border-[rgba(139,92,246,0.15)] shadow-sm">
              <table className="w-full min-w-[640px] border-collapse text-sm md:text-base">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]">
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold text-slate-900 dark:text-white w-[34%]"
                    />
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold text-[#7C3AED] dark:text-[#A78BFA] w-[33%]"
                    >
                      {content.comparisonTable.headers[1]}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold text-slate-700 dark:text-[#9593A8] w-[33%]"
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
                        <CellValue value={row.newo} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Reasons */}
        <section className="py-16 md:py-20 px-4 bg-slate-100/80 dark:bg-[#0b0b1a]/50">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
              {content.reasonsSectionTitle}
            </h2>
            <ol className="space-y-10 list-none p-0 m-0">
              {content.reasons.map((item, index) => (
                <li key={item.title}>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    <span className="text-[#8B5CF6] dark:text-[#A78BFA] me-2">{index + 1}.</span>
                    {item.title}
                  </h3>
                  <p className="mt-3 text-slate-600 dark:text-[#9593A8] leading-relaxed whitespace-pre-line">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* When Newo is better */}
        <section className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {content.whenCompetitorSectionTitle}
            </h2>
            <p className="text-slate-600 dark:text-[#9593A8] leading-relaxed mb-6">
              {content.whenCompetitorIntro}
            </p>
            <ul className="space-y-4 list-disc ps-5 text-slate-600 dark:text-[#9593A8] leading-relaxed">
              {content.whenCompetitorBullets.map((bullet) => (
                <li key={bullet.slice(0, 48)}>{bullet}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
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

        {/* Final CTA */}
        <section className="py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              {content.finalCta.headline}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-[#9593A8] leading-relaxed">{content.finalCta.body}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link href={content.setupHref}>
                <Button className="h-12 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold">
                  {content.finalCta.primaryCtaLabel}
                  <ArrowRight className="w-4 h-4 ms-2 inline" aria-hidden />
                </Button>
              </Link>
              <Link
                href={content.finalCta.secondaryHref}
                className="text-sm font-medium text-[#8B5CF6] hover:text-[#7C3AED] dark:text-[#A78BFA] hover:underline"
              >
                {content.finalCta.secondaryLabel} →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <ComparisonFooter />
    </>
  )
}
