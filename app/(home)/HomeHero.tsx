'use client';
import Image from 'next/image';

export default function HomeHero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          {/* Left: text & CTAs */}
          <div>
            <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium text-teal-300">
              AI-Powered Scheduling
            </span>

            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-100 md:text-5xl">
              Intelligent Booking <span className="text-teal-300">&amp; Automation</span>
            </h1>

            <p className="mt-4 max-w-xl text-slate-300">
              Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/auth/login"
                className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-400"
              >
                Start Free Trial
              </a>
              <a
                href="/b/waismofit"
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800/50"
              >
                Watch Demo →
              </a>
            </div>

            <div className="mt-4 text-xs text-slate-400">
              ✓ No credit card required • ✓ Free 14-day trial
            </div>
          </div>

          {/* Right: big, bounded image */}
          <div className="relative mx-auto w-full max-w-xl md:max-w-2xl">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-3 shadow-xl">
              <Image
                src="/hero-book8.svg"   // or /hero-book8.png if you prefer
                alt="Book8 AI — Hero"
                width={1200}
                height={900}
                priority
                sizes="(min-width: 1024px) 600px, (min-width: 768px) 560px, 90vw"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
