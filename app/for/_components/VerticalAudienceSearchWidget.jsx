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
    let phase = "type"; // type | pause | erase
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
        // erase
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
    <div className="relative">
      <Input
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 pr-3"
        placeholder=""
        inputMode="url"
      />

      {showOverlay ? (
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <span className="text-sm text-slate-400">
            {typedDomain}
            <span
              className="ml-0.5 inline-block w-[2px] h-[14px] bg-slate-400 align-middle rounded-sm"
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

export default function VerticalAudienceSearchWidget({ vertical }) {
  const router = useRouter();

  const domainExample = useMemo(() => "yourbusiness.com", []);
  const typedDomain = useTypedText({ text: domainExample });

  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState(vertical.searchCategoryDefault);

  useEffect(() => {
    setCategory(vertical.searchCategoryDefault);
  }, [vertical.searchCategoryDefault]);

  const onSubmit = () => {
    // Marketing UX: route into setup and carry along context.
    const params = new URLSearchParams();
    params.set("vertical", vertical.slug);
    if (domain.trim()) params.set("domain", domain.trim());
    router.push(`/setup?${params.toString()}`);
  };

  const categories = ["Barber", "Dental", "Spa", "Fitness", "Medical", "Restaurant", "Other"];

  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-[rgba(139,92,246,0.14)] dark:bg-[#121228]/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Stop losing $1,200-2,500/month to missed calls
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Book8 captures every booking that would have gone to voicemail — and pays for itself with 1-2 recovered appointments per month.
          </p>
        </div>
        <div className="hidden sm:block">
          <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white/90">
            70+ languages
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <div>
          <AnimatedDomainInput domain={domain} setDomain={setDomain} typedDomain={typedDomain} />

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Button
              type="button"
              onClick={onSubmit}
              className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6"
            >
              Listen to your AI
            </Button>

            <p className="text-xs text-slate-500 sm:text-right">
              in 3 minutes, you&apos;ll be talking to your AI
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/10">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-[#9593A8]">
            Find your business on Google
          </p>

          <div className="mt-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-100/60 text-slate-900 dark:border-[rgba(139,92,246,0.18)] dark:bg-[#0A0A0F] dark:text-white">
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

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                Popular searches for {vertical.label}:
              </p>
              <Link
                href={`/for/${vertical.slug}`}
                className="text-[11px] font-semibold text-[#8B5CF6] hover:underline"
              >
                {vertical.targetSearches[0]}
              </Link>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap gap-2">
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

          <div className="mt-3 flex justify-end">
            <Link
              href={`/setup?vertical=${encodeURIComponent(vertical.slug)}&manual=1`}
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

