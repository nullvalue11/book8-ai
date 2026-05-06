"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { verticals } from "@/for/_data/verticals";
import { cn } from "@/lib/utils";

function useTypedText({
  text,
  speedMs = 45,
  eraseMs = 18,
  pauseMs = 900,
  loop = true
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [typed, setTyped] = useState(prefersReducedMotion ? text : "");
  useEffect(() => {
    if (prefersReducedMotion) return;

    let cancelled = false;
    let phase = "type";
    let i = 0;

    const tick = () => {
      if (cancelled) return;

      if (phase === "type") {
        i = Math.min(text.length, i + 1);
        setTyped(text.slice(0, i));
        if (i >= text.length) phase = "pause";
      } else if (phase === "pause") {
        phase = "erase";
      } else {
        i = Math.max(0, i - 1);
        setTyped(text.slice(0, i));
        if (i <= 0) {
          if (!loop) return;
          phase = "type";
        }
      }

      const delay =
        phase === "type" ? speedMs : phase === "erase" ? eraseMs : pauseMs;
      window.setTimeout(tick, delay);
    };

    window.setTimeout(tick, speedMs);
    return () => {
      cancelled = true;
    };
  }, [eraseMs, loop, pauseMs, prefersReducedMotion, speedMs, text]);

  return typed;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const onChange = () => setReduced(!!mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

function AnimatedDomainInput({ domain, setDomain, typedDomain }) {
  const [focused, setFocused] = useState(false);
  const showOverlay = !focused && domain.trim().length === 0;

  return (
    <div className="relative min-w-0">
      <Input
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          "h-11 w-full min-w-0 rounded-xl pr-3 transition-colors",
          "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
          "dark:border-slate-600/70 dark:bg-slate-900/55 dark:text-slate-100 dark:placeholder:text-slate-500",
          "focus-visible:border-slate-300 dark:focus-visible:border-[rgba(139,92,246,0.35)]",
          "focus-visible:ring-2 focus-visible:!ring-offset-0 focus-visible:!ring-violet-500/40 dark:focus-visible:!ring-[#A78BFA]/40"
        )}
        placeholder=""
        inputMode="url"
      />

      {showOverlay ? (
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {typedDomain}
            <span
              className="ml-0.5 inline-block w-[2px] h-[14px] bg-slate-400 dark:bg-slate-500 align-middle rounded-sm"
              style={{
                animation: "b8-blink 1.1s step-end infinite"
              }}
              aria-hidden
            />
          </span>
        </div>
      ) : null}
      <style jsx>{`
        @keyframes b8-blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

const categories = ["Barber", "Dental", "Spa", "Fitness", "Medical", "Restaurant", "Other"];

const homeIndustryLinks = Object.values(verticals);

export default function AudienceSearchWidget({ vertical, className }) {
  const router = useRouter();

  const domainExample = useMemo(() => "yourbusiness.com", []);
  const typedDomain = useTypedText({ text: domainExample });

  const [domain, setDomain] = useState("");
  const defaultCategory = vertical?.searchCategoryDefault ?? "Other";
  const [category, setCategory] = useState(defaultCategory);

  useEffect(() => {
    setCategory(vertical?.searchCategoryDefault ?? "Other");
  }, [vertical?.searchCategoryDefault]);

  const onSubmit = () => {
    if (vertical) {
      const params = new URLSearchParams();
      params.set("vertical", vertical.slug);
      if (domain.trim()) params.set("domain", domain.trim());
      router.push(`/setup?${params.toString()}`);
      return;
    }
    if (domain.trim()) {
      router.push(`/setup?url=${encodeURIComponent(domain.trim())}`);
    } else {
      router.push("/setup");
    }
  };

  return (
    <div
      className={cn(
        "mt-8 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-[rgba(139,92,246,0.14)] dark:bg-[#121228]/70 max-w-full",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Stop losing $1,200-2,500/month to missed calls
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Book8 captures every booking that would have gone to voicemail — and pays for itself with 1-2 recovered appointments per month.
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white/90">
            70+ languages
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 min-w-0">
        <div className="min-w-0">
          <AnimatedDomainInput domain={domain} setDomain={setDomain} typedDomain={typedDomain} />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0">
            <Button
              type="button"
              onClick={onSubmit}
              className="h-11 w-full sm:w-auto shrink-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
            >
              Listen to your AI
            </Button>

            <p className="text-xs text-slate-500 sm:text-right min-w-0">
              in 3 minutes, you&apos;ll be talking to your AI
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 min-w-0">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-[#9593A8]">
            Find your business on Google
          </p>

          <div className="mt-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-slate-100/60 text-slate-900 dark:border-[rgba(139,92,246,0.18)] dark:bg-[#0A0A0F] dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="dark:text-white">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
              <p className="text-[11px] text-slate-500 shrink-0">
                {vertical ? (
                  <>Popular searches for {vertical.label}:</>
                ) : (
                  <>Browse industry guides:</>
                )}
              </p>
              {vertical ? (
                <Link
                  href={`/for/${vertical.slug}`}
                  className="text-[11px] font-semibold text-[#8B5CF6] hover:underline break-words"
                >
                  {vertical.targetSearches[0]}
                </Link>
              ) : (
                <Link
                  href="/for/barbershops"
                  className="text-[11px] font-semibold text-[#8B5CF6] hover:underline"
                >
                  Barbershops
                </Link>
              )}
            </div>
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap gap-2">
              {vertical
                ? vertical.targetSearches.map((item) => (
                    <span
                      key={item}
                      className="text-xs rounded-full bg-[rgba(139,92,246,0.10)] text-[#6D28D9] border border-[rgba(139,92,246,0.20)] px-3 py-1 dark:text-[#A78BFA]"
                    >
                      {item}
                    </span>
                  ))
                : homeIndustryLinks.map((v) => (
                    <Link
                      key={v.slug}
                      href={`/for/${v.slug}`}
                      className="text-xs rounded-full bg-[rgba(139,92,246,0.10)] text-[#6D28D9] border border-[rgba(139,92,246,0.20)] px-3 py-1 dark:text-[#A78BFA] hover:opacity-90"
                    >
                      {v.label}
                    </Link>
                  ))}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href={
                vertical
                  ? `/setup?vertical=${encodeURIComponent(vertical.slug)}&manual=1`
                  : "/setup?manual=1"
              }
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-[#9593A8] dark:hover:text-white"
            >
              I&apos;ll enter manually
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
