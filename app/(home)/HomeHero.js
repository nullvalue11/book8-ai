import Image from "next/image";
import Link from "next/link";

export default function HomeHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className="order-2 md:order-1">
        <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          AI-Powered Scheduling
        </span>
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
          Intelligent Booking{" "}
          <span className="bg-brand-gradient bg-clip-text text-transparent">&amp; Automation</span>
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground leading-relaxed">
          Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/pricing" className="inline-flex h-11 items-center justify-center rounded-md px-4 font-medium bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-[0_8px_24px_-12px_rgba(124,77,255,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Start Free Trial
          </Link>
          <a href="#demo" className="inline-flex h-11 items-center justify-center rounded-md px-4 font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors">
            Watch Demo →
          </a>
        </div>
      </div>

      <div className="order-1 md:order-2 mt-8 md:mt-0">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_0_72px_-28px_rgba(124,77,255,.45)] transition-transform md:hover:-translate-y-0.5">
          {/* Light mode icon */}
          <Image
            src="/brand/book8_ai_icon.png"
            alt="Book8 AI - Intelligent scheduling platform powered by artificial intelligence"
            width={320}
            height={320}
            className="mx-auto h-auto w-64 md:w-80 dark:hidden"
            priority
          />
          {/* Dark mode icon */}
          <Image
            src="/brand/book8_ai_icon_white.png"
            alt="Book8 AI - Intelligent scheduling platform powered by artificial intelligence"
            width={320}
            height={320}
            className="mx-auto h-auto w-64 md:w-80 hidden dark:block"
            priority
          />
        </div>
      </div>

      <div className="col-span-full mx-auto my-10 h-px w-full max-w-6xl bg-gradient-to-r from-transparent via-brand-500/15 to-transparent" />
    </section>
  );
}
