'use client';
import Image from 'next/image';
import Link from 'next/link';

export default function HomeHero() {
  return (
    <div className="relative isolate bg-hero-radial">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2">
        {/* Left: Headline + CTA */}
        <div className="order-2 md:order-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500" /> AI-Powered Scheduling
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Intelligent Booking <span className="bg-brand-gradient bg-clip-text text-transparent">& Automation</span>
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-white/75">
            Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="#auth" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 transition">
              Start Free Trial
            </Link>
            <Link href="#demo" className="rounded-lg border border-white/12 px-4 py-2 text-sm font-medium text-white/80 hover:text-white hover:border-white/20 transition">
              Watch Demo →
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
            <span className="flex items-center gap-1">✓ No credit card required</span>
            <span className="flex items-center gap-1">✓ Free 14-day trial</span>
          </div>
        </div>

        {/* Right: Atom icon with glow */}
        <div className="relative order-1 md:order-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_0_80px_-28px_rgba(124,77,255,0.55)]">
            <Image
              src="/brand/book8_ai_icon_color.png"
              alt="Book8 atom"
              width={420}
              height={420}
              className="mx-auto h-auto w-64 md:w-80"
              priority
            />
          </div>
        </div>
      </div>
      
      {/* Section divider */}
      <div className="mx-auto my-12 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
