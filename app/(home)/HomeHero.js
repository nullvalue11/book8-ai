import Image from "next/image";

export default function HomeHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className="order-2 md:order-1">
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
          AI-Powered Scheduling
        </span>
        <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-white">
          Intelligent Booking{" "}
          <span className="bg-brand-gradient bg-clip-text text-transparent">&amp; Automation</span>
        </h1>
        <p className="mt-4 max-w-lg text-white/80 leading-relaxed">
          Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
        </p>
        <div className="mt-8 flex gap-3">
          <a className="inline-flex h-11 items-center rounded-md px-4 font-medium bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.01] transition-transform shadow-[0_8px_24px_-12px_rgba(124,77,255,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Start Free Trial
          </a>
          <a className="inline-flex h-11 items-center rounded-md px-4 font-medium border border-white/12 text-white/80 hover:text-white hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors">
            Watch Demo →
          </a>
        </div>
      </div>

      <div className="order-1 md:order-2 mt-8 md:mt-0">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_0_80px_-28px_rgba(124,77,255,0.45)] transition-transform md:hover:-translate-y-0.5">
          <Image
            src="/brand/book8_ai_icon_color.png"
            alt="Book8 Atom"
            width={320}
            height={320}
            className="mx-auto h-auto w-64 md:w-80"
            priority
          />
        </div>
      </div>

      <div className="col-span-full mx-auto my-10 h-[0.5px] w-full max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}
