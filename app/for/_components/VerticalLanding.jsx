import React from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import AudienceSearchWidget from "@/components/AudienceSearchWidget";
import { verticals } from "../_data/verticals";

function ByIndustryFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-14 px-4 dark:border-[rgba(139,92,246,0.12)] dark:bg-[#06060f]">
      <div className="mx-auto max-w-6xl text-center text-xs text-slate-600 dark:text-[#68668A]">
        © {new Date().getFullYear()} Book8. All rights reserved.
      </div>
    </footer>
  );
}

export default function VerticalLanding({ verticalKey }) {
  const vertical = verticals[verticalKey];
  if (!vertical) {
    return (
      <>
        <Header variant="landing" />
        <main className="min-h-screen flex items-center justify-center px-4">
          <p className="text-sm text-slate-600 dark:text-[#9593A8]">Unknown vertical.</p>
        </main>
        <ByIndustryFooter />
      </>
    );
  }

  return (
    <>
      <Header variant="landing" />

      <main>
        <section className="relative isolate overflow-hidden bg-slate-100 dark:bg-[#0B1020] pt-28 pb-16 px-4">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-[#0A0A0F]/50 border border-slate-200 dark:border-[rgba(139,92,246,0.12)] px-4 py-2">
                  <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-[#D4C4FC]">{vertical.badge}</span>
                </div>

                <h1 className="mt-5 text-3xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight font-[family-name:var(--font-brico)]">
                  {vertical.heroHeadline}
                </h1>
                <p className="mt-4 text-slate-600 dark:text-[#9593A8] text-base md:text-lg">{vertical.heroSubhead}</p>

                <AudienceSearchWidget vertical={vertical} />
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-[rgba(139,92,246,0.18)] bg-white/80 dark:bg-[#121228]/60 dark:border-[rgba(139,92,246,0.22)] p-6">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white font-[family-name:var(--font-brico)]">
                    ROI math
                  </p>
                  <p className="mt-3 text-sm text-slate-600 dark:text-[#9593A8]">{vertical.roiMath}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 dark:bg-[#121228]/60 dark:border-[rgba(139,92,246,0.12)] p-6">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white font-[family-name:var(--font-brico)]">
                    Testimonial
                  </p>
                  <blockquote className="mt-3 italic text-slate-600 dark:text-[#9593A8] min-h-[88px]">
                    {/* TODO: real testimonial when available */}
                  </blockquote>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 dark:bg-[#121228]/60 dark:border-[rgba(139,92,246,0.12)] p-6">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white font-[family-name:var(--font-brico)]">
                    Popular searches
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {vertical.targetSearches.map((s) => (
                      <span
                        key={s}
                        className="text-xs rounded-full bg-[rgba(139,92,246,0.10)] text-[#6D28D9] border border-[rgba(139,92,246,0.20)] px-3 py-1 dark:text-[#A78BFA]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vertical.scenarios.map((scenario, idx) => (
                <div
                  key={`${vertical.slug}-${idx}`}
                  className="rounded-2xl border border-slate-200 bg-white dark:bg-[#121228] dark:border-[rgba(139,92,246,0.12)] p-6"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Scenario {idx + 1}
                  </p>
                  <p className="mt-3 text-sm text-slate-600 dark:text-[#9593A8]">{scenario}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <Link href={`/setup?vertical=${encodeURIComponent(vertical.slug)}`}>
                <Button className="h-14 px-10 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-lg font-semibold shadow-[0_0_40px_-6px_rgba(139,92,246,0.85)]">
                  {vertical.ctaText}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <ByIndustryFooter />
    </>
  );
}

