"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function WaveformBars({ reducedMotion }) {
  const bars = [0, 1, 2, 3, 4];
  if (reducedMotion) {
    return (
      <span className="flex h-4 items-end gap-0.5 shrink-0" aria-hidden>
        {bars.map((i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-white/85"
            style={{ height: 6 + (i % 3) * 2 }}
          />
        ))}
      </span>
    );
  }
  return (
    <span className="flex h-4 items-end gap-0.5 shrink-0" aria-hidden>
      {bars.map((i) => (
        <motion.span
          key={i}
          className="w-0.5 origin-bottom rounded-full bg-white/90"
          style={{ height: 14 }}
          animate={{ scaleY: [0.5, 1, 0.55, 0.9, 0.5] }}
          transition={{
            duration: 1.15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.11
          }}
        />
      ))}
    </span>
  );
}

/**
 * @param {{ onSubmit: () => void, className?: string }} props
 */
function ListenToAiButton({ onSubmit, className }) {
  const reducedMotion = useReducedMotion();
  const [ripple, setRipple] = useState(null);

  const handleClick = useCallback(
    (e) => {
      if (!reducedMotion && e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipple({
          id,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
        window.setTimeout(() => setRipple((r) => (r?.id === id ? null : r)), 550);
      }
      onSubmit();
    },
    [onSubmit, reducedMotion]
  );

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative h-11 w-full overflow-hidden rounded-xl border border-violet-400/25 px-5 font-semibold text-white sm:w-auto",
        "bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6]",
        "shadow-[0_4px_22px_-6px_rgba(139,92,246,0.55)]",
        "hover:shadow-[0_6px_28px_-6px_rgba(139,92,246,0.65)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#121228]",
        className
      )}
      whileHover={reducedMotion ? undefined : { scale: 1.02 }}
      whileTap={reducedMotion ? undefined : { scale: 0.98 }}
      animate={
        reducedMotion
          ? undefined
          : {
              boxShadow: [
                "0 4px 22px -6px rgba(139,92,246,0.55), 0 0 0 0 rgba(167,139,250,0)",
                "0 4px 26px -6px rgba(139,92,246,0.68), 0 0 0 5px rgba(167,139,250,0.14)",
                "0 4px 22px -6px rgba(139,92,246,0.55), 0 0 0 0 rgba(167,139,250,0)"
              ]
            }
      }
      transition={
        reducedMotion
          ? undefined
          : { boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }
      }
    >
      <AnimatePresence>
        {ripple && !reducedMotion ? (
          <motion.span
            key={ripple.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
            style={{ left: ripple.x, top: ripple.y }}
            initial={{ width: 0, height: 0, opacity: 0.45 }}
            animate={{ width: 280, height: 280, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>
      <span className="relative z-[1] inline-flex items-center gap-2.5">
        <WaveformBars reducedMotion={!!reducedMotion} />
        Listen to your AI
      </span>
    </motion.button>
  );
}

export default function AudienceSearchWidget({ vertical, className }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = useCallback(() => {
    const trimmed = value.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("description", trimmed);
    if (vertical?.slug) params.set("vertical", vertical.slug);
    const qs = params.toString();
    router.push(qs ? `/create?${qs}` : "/create");
  }, [router, value, vertical?.slug]);

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
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="text"
          autoComplete="off"
          placeholder="yourbusiness.com or business name"
          className={cn(
            "h-11 w-full min-w-0 rounded-xl pr-3 transition-colors",
            "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400",
            "dark:border-slate-600/70 dark:bg-slate-900/55 dark:text-slate-100 dark:placeholder:text-slate-500",
            "focus-visible:border-slate-300 dark:focus-visible:border-[rgba(139,92,246,0.35)]",
            "focus-visible:ring-2 focus-visible:!ring-offset-0 focus-visible:!ring-violet-500/40 dark:focus-visible:!ring-[#A78BFA]/40"
          )}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
        />

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <ListenToAiButton onSubmit={onSubmit} />
          <p className="text-xs text-slate-500 sm:min-w-0 sm:flex-1 sm:text-right dark:text-slate-400">
            in 3 minutes, you&apos;ll be talking to your AI
          </p>
        </div>
      </div>
    </div>
  );
}
