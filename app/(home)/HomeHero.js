"use client";

import Link from "next/link";
import IPhoneMockup from "../components/IPhoneMockup";

export default function HomeHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating bubbles */}
        <div className="absolute top-20 left-[5%] w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-brand-500/5 to-transparent blur-xl animate-float" />
        <div className="absolute top-40 right-[10%] w-24 h-24 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-accent/5 to-transparent blur-xl animate-float-delayed" />
        <div className="absolute bottom-20 left-[15%] w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-brand-500/5 to-transparent blur-xl animate-float" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(124,77,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,77,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-20">
        {/* Main hero grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* Left: Text content */}
          <div className="order-2 lg:order-1 text-center lg:text-left">
            <span className="inline-flex items-center rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-500">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
              AI-Powered Scheduling
            </span>
            
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              Intelligent Booking{" "}
              <span className="bg-brand-gradient bg-clip-text text-transparent">&amp; Automation</span>
            </h1>
            
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              Connect calendars, enable voice/AI bookings, and leverage real-time web search—all in one platform.
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link 
                href="/pricing" 
                className="inline-flex h-12 items-center justify-center rounded-xl px-6 font-medium bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_30px_-12px_rgba(124,77,255,.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start Free Trial
              </Link>
              <a 
                href="#demo" 
                className="inline-flex h-12 items-center justify-center rounded-xl px-6 font-medium border border-border bg-background/50 backdrop-blur-sm text-foreground hover:bg-muted/50 hover:border-foreground/20 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Watch Demo
              </a>
            </div>
            
            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right: iPhone mockup */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <IPhoneMockup />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-auto my-16 h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-brand-500/20 to-transparent" />

        {/* Feature highlights row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-4xl mx-auto">
          {[
            { icon: "📅", label: "Calendar Sync", desc: "Google, Outlook" },
            { icon: "🎙️", label: "Voice AI", desc: "Phone bookings" },
            { icon: "🔍", label: "Web Search", desc: "Real-time intel" },
            { icon: "📱", label: "Mobile App", desc: "Coming soon" },
          ].map((feature, i) => (
            <div key={i} className="text-center group">
              <div className="mx-auto w-12 h-12 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-2xl group-hover:scale-110 group-hover:border-brand-500/30 transition-all">
                {feature.icon}
              </div>
              <div className="mt-3 font-medium text-foreground text-sm">{feature.label}</div>
              <div className="text-xs text-muted-foreground">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
