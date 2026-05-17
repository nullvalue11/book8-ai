"use client";

import React, { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import HeroAutocomplete from "@/components/HeroAutocomplete";
import OrbStaticFallback from "@/components/AnimatedAIOrb/OrbStaticFallback";

const AnimatedAIOrb = dynamic(() => import("@/components/AnimatedAIOrb"), {
  ssr: false,
  loading: () => (
    <div className="relative mx-auto h-[220px] w-[min(100%,300px)] min-h-[220px] sm:h-[300px] sm:w-[300px]">
      <OrbStaticFallback palette="cyan" />
    </div>
  )
});

export default function AudienceSearchWidget({ vertical, className }) {
  const router = useRouter();
  const heroRef = useRef(/** @type {{ resolveCtaSelection: () => unknown, showPickHint?: () => void } | null} */ (null));

  const handleHeroSelect = useCallback(
    (selection) => {
      if (selection.type === "place") {
        router.push(
          `/setup?placeId=${encodeURIComponent(selection.placeId)}&sessionToken=${encodeURIComponent(selection.sessionToken)}`
        );
      } else {
        router.push(`/setup?url=${encodeURIComponent(selection.url)}`);
      }
    },
    [router]
  );

  const onSubmit = useCallback(() => {
    const sel = heroRef.current?.resolveCtaSelection?.();
    if (!sel) {
      heroRef.current?.showPickHint?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("book8:hero_autocomplete_skip"));
      }
      return;
    }
    if (typeof window !== "undefined" && sel.type === "place") {
      window.dispatchEvent(
        new CustomEvent("book8:hero_autocomplete_select", {
          detail: { placeId: sel.placeId, name: sel.name }
        })
      );
    }
    handleHeroSelect(sel);
  }, [handleHeroSelect]);

  return (
    <div
      className={cn(
        "mt-8 w-full max-w-full rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5 dark:border-[rgba(139,92,246,0.14)] dark:bg-[#121228]/70",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white/90 dark:bg-white/10 dark:text-white">
          70+ languages
        </span>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col items-center gap-2 pb-1">
          <AnimatedAIOrb
            size="medium"
            palette="cyan"
            onClick={onSubmit}
            ariaLabel="Listen to a demo of the AI assistant"
            className="max-w-full"
          />
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Tap the orb to hear it speak
          </p>
        </div>

        <HeroAutocomplete ref={heroRef} placeholder="yourbusiness.com or business name" />

        <p className="text-center text-xs text-slate-500 dark:text-slate-400 sm:text-right">
          in 3 minutes, you&apos;ll be talking to your AI
        </p>
      </div>
    </div>
  );
}
