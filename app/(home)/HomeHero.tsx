'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Shield, Clock, Zap, Users, Lock } from 'lucide-react';

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
      <div className="mx-auto my-8 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Features Section - Clear App Description */}
      <div id="features" className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Everything You Need for Smart Scheduling
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto">
            Book8 AI is a comprehensive appointment scheduling platform that helps businesses and professionals manage their time efficiently with AI-powered features.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center mb-4">
              <Calendar className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Calendar Sync</h3>
            <p className="text-white/60 text-sm">
              Connect your Google Calendar to automatically sync bookings and check availability in real-time. Keep everything organized in one place.
            </p>
          </div>
          
          {/* Feature 2 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">AI-Powered Booking</h3>
            <p className="text-white/60 text-sm">
              Let AI handle your scheduling with intelligent time slot suggestions, automated reminders, and smart conflict detection.
            </p>
          </div>
          
          {/* Feature 3 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Shareable Booking Links</h3>
            <p className="text-white/60 text-sm">
              Create personalized booking pages that you can share with clients. They pick a time that works, and it automatically appears on your calendar.
            </p>
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div className="mx-auto my-4 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Data Transparency Section - Google OAuth Compliance */}
      <div id="data-transparency" className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                Your Data Privacy Matters
              </h2>
              <p className="text-white/60">
                We are committed to transparency about how we use your information.
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Calendar Access */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                Why We Need Access to Your Calendar
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-green-400 mt-1">✓</span>
                  <span><strong className="text-white/90">Sync availability:</strong> We read your calendar events to show when you're available for bookings and prevent double-bookings.</span>
                </li>
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-green-400 mt-1">✓</span>
                  <span><strong className="text-white/90">Create appointments:</strong> When someone books time with you, we create a calendar event on your behalf with all the meeting details.</span>
                </li>
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-green-400 mt-1">✓</span>
                  <span><strong className="text-white/90">Manage changes:</strong> If a booking is rescheduled or canceled, we update or remove the calendar event automatically.</span>
                </li>
              </ul>
            </div>

            {/* What We DON'T Do */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-400" />
                What We Never Do With Your Data
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>We <strong className="text-white/90">never share</strong> your calendar data with third parties</span>
                </li>
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>We <strong className="text-white/90">never sell</strong> your personal information or usage data</span>
                </li>
                <li className="flex items-start gap-3 text-white/70">
                  <span className="text-red-400 mt-1">✗</span>
                  <span>We <strong className="text-white/90">never access</strong> calendar data beyond what's needed for scheduling</span>
                </li>
              </ul>
            </div>

            {/* Privacy Link */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              <p className="text-white/50 text-sm">
                For complete details on how we handle your data, please review our privacy policy.
              </p>
              <Link 
                href="/privacy" 
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition"
              >
                <Shield className="w-4 h-4" />
                Read Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div className="mx-auto my-12 h-px max-w-6xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
