"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "book8_cookie_consent";
const VALID_VALUES = new Set(["accepted_all", "essential_only"]);

export default function CookieConsentBanner() {
  const [isMounted, setIsMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (!existing || !VALID_VALUES.has(existing)) {
        setShouldShow(true);
      }
    } catch {
      setShouldShow(true);
    }
  }, []);

  const persistConsent = (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // localStorage may be unavailable (private mode, blocked, etc.).
      // The banner still closes for the current session.
    }
    setShouldShow(false);
  };

  if (!isMounted || !shouldShow) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0a0a0f]/95 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-zinc-300">
            We use cookies for essential site functionality (authentication,
            session management) and optional analytics. Read our{" "}
            <Link
              href="/privacy"
              className="text-brand-400 underline-offset-2 hover:text-brand-300 hover:underline"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/sub-processors"
              className="text-brand-400 underline-offset-2 hover:text-brand-300 hover:underline"
            >
              Sub-Processors
            </Link>
            .
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <button
              type="button"
              onClick={() => persistConsent("essential_only")}
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 px-4 text-sm font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
            >
              Reject Non-Essential
            </button>
            <button
              type="button"
              onClick={() => persistConsent("accepted_all")}
              className="inline-flex h-10 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
