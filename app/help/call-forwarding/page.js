"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import LanguageSelector from "@/components/LanguageSelector";
import { useBookingLanguage } from "@/hooks/useBookingLanguage";
import { trFormat } from "@/lib/translations";
import { CALL_FORWARDING_COUNTRY_GROUPS } from "@/lib/call-forwarding-data";

function renderBacktickCodes(text, keyPrefix) {
  const segments = text.split(/(`[^`]*`)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("`") && seg.endsWith("`")) {
      const inner = seg.slice(1, -1);
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="mx-0.5 rounded bg-white/10 px-1.5 py-0.5 text-sm text-[#E9D5FF] font-mono"
        >
          {inner}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{seg}</span>;
  });
}

function StepText({ step, book8Display, stepKey }) {
  const filled = step.replace(/\{book8Number\}/g, book8Display);
  return <span className="text-[#CBD5E1] leading-relaxed">{renderBacktickCodes(filled, stepKey)}</span>;
}

function CallForwardingInner() {
  const searchParams = useSearchParams();
  const { language, setLanguage, t } = useBookingLanguage();
  const c = t.callForwarding;
  const isRtl = language === "ar";
  const [query, setQuery] = useState("");

  const rawNumber = searchParams.get("number");
  const book8Display = rawNumber?.trim()
    ? rawNumber.trim()
    : c.placeholderBracket;

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CALL_FORWARDING_COUNTRY_GROUPS;
    return CALL_FORWARDING_COUNTRY_GROUPS.map((group) => ({
      ...group,
      carriers: group.carriers.filter((carrier) => {
        const hay = [carrier.name, ...(carrier.searchExtra || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    })).filter((g) => g.carriers.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-[#0A0A0F]" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      <header className="border-b border-white/10 sticky top-0 bg-[#0A0A0F]/95 backdrop-blur-md z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors min-w-0 text-sm"
          >
            <ArrowLeft className="w-4 h-4 shrink-0 rtl:rotate-180" />
            <span className="truncate">{c.backHome}</span>
          </Link>
          <LanguageSelector
            value={language}
            onChange={setLanguage}
            t={t}
            variant="dark"
            className="border-white/20 bg-white/5 text-white shrink-0"
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 pb-20">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
          {c.title}
        </h1>
        <p className="text-[#94A3B8] text-sm sm:text-base mb-8">{c.subtitle}</p>

        {!rawNumber?.trim() ? (
          <div className="rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/10 px-4 py-3 mb-8">
            <p className="text-sm text-[#E9D5FF]">
              <span className="font-mono font-semibold text-white">{c.placeholderBracket}</span>
              <span className="text-[#94A3B8]"> — {c.findInDashboard}</span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#1e1e2e] bg-[#12121A] px-4 py-3 mb-8">
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B] mb-1">{c.yourBook8NumberLabel}</p>
            <p className="text-lg font-mono text-[#A78BFA]">{rawNumber.trim()}</p>
          </div>
        )}

        <div className="relative mb-10">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.searchPlaceholder}
            className="ps-10 h-11 bg-[#12121A] border-[#1e1e2e] text-[#F8FAFC] placeholder:text-[#64748B]"
            aria-label={c.searchPlaceholder}
          />
        </div>

        {filteredGroups.length === 0 ? (
          <p className="text-[#94A3B8] text-sm">{c.noCarriersMatch}</p>
        ) : (
          <div className="space-y-10">
            {filteredGroups.map((group) => (
              <section key={group.id}>
                <h2 className="text-lg font-semibold text-[#F8FAFC] mb-4 flex items-center gap-2">
                  <span aria-hidden>{group.flag}</span>
                  <span>{c[group.countryLabelKey]}</span>
                </h2>
                <Accordion type="multiple" className="space-y-2">
                  {group.carriers.map((carrier) => (
                    <AccordionItem
                      key={carrier.id}
                      value={carrier.id}
                      className="border border-[#1e1e2e] rounded-lg bg-[#12121A] px-1 data-[state=open]:border-[#8B5CF6]/40"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline text-start text-[#F8FAFC] font-medium">
                        {carrier.name}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-0">
                        <ol className="list-decimal list-inside space-y-3 text-sm">
                          {carrier.steps.map((step, idx) => (
                            <li key={idx} className="ps-1 marker:text-[#8B5CF6]">
                              <StepText step={step} book8Display={book8Display} stepKey={`${carrier.id}-${idx}`} />
                            </li>
                          ))}
                        </ol>
                        <p className="mt-4 text-sm text-[#94A3B8]">
                          <span className="font-medium text-[#CBD5E1]">{c.toCancel}:</span>{" "}
                          {renderBacktickCodes(
                            carrier.cancel.replace(/\{book8Number\}/g, book8Display),
                            `${carrier.id}-cx`
                          )}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            ))}
          </div>
        )}

        <section className="mt-14 pt-10 border-t border-white/10">
          <h2 className="text-lg font-semibold text-[#F8FAFC] mb-4">{c.conditionalForwarding}</h2>
          <ul className="space-y-3 text-sm text-[#94A3B8]">
            <li>
              <span className="font-medium text-[#CBD5E1]">{c.forwardNoAnswer}:</span>{" "}
              {renderBacktickCodes(
                `Dial \`**61*${book8Display}#\` ${c.pressCallSuffix}`,
                "cf1"
              )}
            </li>
            <li>
              <span className="font-medium text-[#CBD5E1]">{c.forwardBusy}:</span>{" "}
              {renderBacktickCodes(
                `Dial \`**67*${book8Display}#\` ${c.pressCallSuffix}`,
                "cf2"
              )}
            </li>
            <li>
              <span className="font-medium text-[#CBD5E1]">{c.forwardUnreachable}:</span>{" "}
              {renderBacktickCodes(
                `Dial \`**62*${book8Display}#\` ${c.pressCallSuffix}`,
                "cf3"
              )}
            </li>
            <li>
              <span className="font-medium text-[#CBD5E1]">{c.cancelAll}:</span>{" "}
              {renderBacktickCodes(`Dial \`##002#\` ${c.pressCallSuffix}`, "cf4")}
            </li>
          </ul>
        </section>

        <section className="mt-8 rounded-xl border border-[#1e1e2e] bg-[#12121A] p-4">
          <p className="text-sm text-[#94A3B8]">{trFormat(c.gsmNote, { book8Number: book8Display })}</p>
        </section>

        <footer className="mt-14 text-center space-y-3">
          <p className="text-[#94A3B8] text-sm font-medium">{c.stillNeedHelp}</p>
          <a
            href="mailto:support@book8.io"
            className="inline-flex items-center justify-center gap-2 text-[#A78BFA] hover:text-[#E9D5FF] text-sm font-medium"
          >
            <Mail className="w-4 h-4" />
            {c.contactSupport}
          </a>
        </footer>
      </main>
    </div>
  );
}

export default function CallForwardingHelpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center text-[#94A3B8] text-sm">
          Loading…
        </div>
      }
    >
      <CallForwardingInner />
    </Suspense>
  );
}
