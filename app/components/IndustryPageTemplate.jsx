import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { SETUP_NEW_BUSINESS_QUERY } from '@/lib/setup-entry'
import { ArrowRight, MessageCircle } from 'lucide-react'

function setupHref(vertical) {
  return `/setup?${SETUP_NEW_BUSINESS_QUERY}&vertical=${encodeURIComponent(vertical)}`
}

function IndustryFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-14 px-4 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#06060f]">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600 dark:text-[#68668A]">
        <p>© {new Date().getFullYear()} Book8. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/pricing" className="hover:text-[#8B5CF6] transition-colors">
            Pricing
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

/**
 * @param {{
 *   vertical: string,
 *   hero: { headline: string, subheadline: string, primaryCtaLabel: string },
 *   painPoints: Array<{ title: string, body: string }>,
 *   features: Array<{ title: string, body: string }>,
 *   faq: Array<{ question: string, answer: string }>,
 *   ctaLabel: string,
 *   testimonialMessage: string
 * }} props
 */
export default function IndustryPageTemplate({
  vertical,
  hero,
  painPoints,
  features,
  faq,
  ctaLabel,
  testimonialMessage
}) {
  return (
    <>
      <Header variant="landing" />
      <main id="main-content" className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-[#06060f] dark:via-[#0b0b1a] dark:to-[#06060f] text-slate-900 dark:text-[#EEEDF5]">
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
              Book8 for {vertical.replace(/-/g, ' ')}
            </p>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {hero.headline}
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-[#9593A8] leading-relaxed">{hero.subheadline}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <Link href={setupHref(vertical)} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-base font-semibold shadow-[0_0_28px_-8px_rgba(139,92,246,0.7)]">
                  {hero.primaryCtaLabel}
                  <ArrowRight className="w-4 h-4 ms-2 inline" aria-hidden />
                </Button>
              </Link>
              <Link
                href="/#main-content"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-[#9593A8] dark:hover:text-white px-4 py-3"
              >
                <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
                Listen to your AI
              </Link>
            </div>
          </div>
        </section>

        {/* Pain points */}
        <section className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
              Sound familiar?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {painPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]/80"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-3 text-sm text-slate-600 dark:text-[#9593A8] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-20 px-4 bg-slate-100/80 dark:bg-[#0b0b1a]/50">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-10">
              Built for your business
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
              {features.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#121228]"
                >
                  <h3 className="text-base font-semibold text-[#8B5CF6] dark:text-[#A78BFA]">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-[#9593A8] leading-relaxed">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonial placeholder */}
        <section className="py-12 px-4">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-dashed border-[#8B5CF6]/40 bg-[rgba(139,92,246,0.06)] p-8 text-center dark:bg-[rgba(139,92,246,0.08)]">
              <p className="text-sm font-medium text-slate-500 dark:text-[#9593A8] uppercase tracking-wide mb-2">
                Testimonial
              </p>
              <p className="text-slate-700 dark:text-[#C4B5FD] italic">{testimonialMessage}</p>
            </div>
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">
              Frequently asked questions
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faq.map((item) => (
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

        {/* Bottom CTA */}
        <section className="py-20 px-4 border-t border-slate-200/80 dark:border-[rgba(139,92,246,0.08)]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{ctaLabel}</h2>
            <Link href={setupHref(vertical)} className="inline-block mt-8">
              <Button className="h-14 px-10 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-lg font-semibold shadow-[0_0_40px_-6px_rgba(139,92,246,0.85)]">
                {hero.primaryCtaLabel}
                <ArrowRight className="w-5 h-5 ms-2 inline" aria-hidden />
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <IndustryFooter />
    </>
  )
}
