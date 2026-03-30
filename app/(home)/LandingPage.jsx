'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Phone,
  Calendar,
  Check,
  MessageSquare,
  Globe,
  Building2,
  BarChart3,
  ChevronDown,
  Scissors,
  Dumbbell,
  Sparkles,
  Stethoscope,
  Zap,
  Rocket,
  Languages,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import PricingPlanFeatureList from '@/components/PricingPlanFeatureList';
import { PRICING_CALL_MINUTES_FOOTNOTE } from '@/lib/pricing-plan-features';
import { SETUP_NEW_BUSINESS_PATH, setupUrlWithNewBusiness } from '@/lib/setup-entry';
import { faqItems } from '@/lib/faq-items';

function useIntersectionObserver(ref, options = {}) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return isVisible;
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const howRef = useRef(null);
  const featuresRef = useRef(null);
  const heroVisible = useIntersectionObserver(heroRef);
  const howVisible = useIntersectionObserver(howRef);
  const featuresVisible = useIntersectionObserver(featuresRef);

  return (
    <div className="font-landing-body">
      {/* HERO */}
      <section
        ref={heroRef}
        className="relative min-h-[85vh] flex items-center overflow-hidden"
        style={{ background: '#0A0A0F' }}
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 70% 20%, rgba(139,92,246,0.25), transparent 50%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(6,182,212,0.1), transparent 50%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
                style={{ color: '#F8FAFC', fontFamily: "'Sora', sans-serif" }}
              >
                <span
                  className={`block transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '0ms' }}
                >
                  Your AI Receptionist.
                </span>
                <span
                  className={`block transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '100ms' }}
                >
                  Always On. Always Booking.
                </span>
              </h1>
              <p
                className={`text-lg text-[#94A3B8] max-w-xl leading-relaxed transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '200ms' }}
              >
                Your AI receptionist answers calls, books appointments, and speaks your customer&apos;s language —
                automatically.
              </p>
              <div
                className={`flex flex-wrap gap-4 transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '300ms' }}
              >
                <Link href={SETUP_NEW_BUSINESS_PATH}>
                  <Button
                    className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white h-12 px-6 rounded-lg font-medium"
                    size="lg"
                  >
                    Get Started Free →
                  </Button>
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                >
                  See How It Works
                  <ChevronDown aria-hidden className="w-4 h-4 animate-bounce" />
                </a>
              </div>
              <div
                className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-x-6 sm:gap-y-2 text-sm text-[#94A3B8] transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  Answers calls 24/7
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  Books appointments in real time
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  Speaks 70+ languages automatically
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  SMS + email confirmations
                </span>
              </div>
            </div>
            {/* Hero visual: flow diagram */}
            <div
              className={`relative transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '300ms' }}
            >
              <div
                className="rounded-2xl border border-[#1e1e2e] p-8"
                style={{ background: '#12121A' }}
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center animate-pulse">
                      <Phone className="w-7 h-7 text-[#8B5CF6]" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">Phone rings</p>
                      <p className="text-sm text-[#94A3B8]">Customer calls your number</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8]" aria-hidden />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-[#06B6D4]" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">AI checks calendar</p>
                      <p className="text-sm text-[#94A3B8]">Real-time availability</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8]" aria-hidden />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-7 h-7 text-green-400" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">Appointment booked</p>
                      <p className="text-sm text-[#94A3B8]">SMS + Email sent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section
        className="py-8 border-y border-[#1e1e2e]"
        style={{ background: '#0A0A0F' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-[#94A3B8] text-sm">
            Trusted by barbers, dental clinics, spas, and fitness studios worldwide
          </p>
          <div className="flex flex-wrap justify-center gap-8 mt-4">
            {[
              { icon: Scissors, label: 'Barbers' },
              { icon: Stethoscope, label: 'Dental Clinics' },
              { icon: Sparkles, label: 'Spas' },
              { icon: Dumbbell, label: 'Fitness Studios' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-[#64748B]"
              >
                <Icon className="w-5 h-5" aria-hidden />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        ref={howRef}
        className="py-20 md:py-28"
        style={{ background: '#0A0A0F' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className={`text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center transition-all duration-700 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {[
              {
                num: 1,
                icon: Calendar,
                title: 'Connect Your Calendar',
                desc: 'Link your Google or Outlook calendar. Book8 AI reads your availability in real-time.',
              },
              {
                num: 2,
                icon: Phone,
                title: 'Get Your AI Phone Number',
                desc: 'We assign a dedicated phone number with an AI agent trained on your services, hours, and booking rules.',
              },
              {
                num: 3,
                icon: Check,
                title: 'Customers Call & Book',
                desc: 'When customers call, the AI handles everything — availability, booking, confirmations. You just show up for the appointment.',
              },
            ].map(({ num, icon: Icon, title, desc }, i) => (
              <div
                key={num}
                className={`relative rounded-xl border border-[#1e1e2e] p-8 transition-all duration-700 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{
                  background: '#12121A',
                  transitionDelay: `${200 + i * 100}ms`,
                }}
              >
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-[#8B5CF6] flex items-center justify-center text-sm font-bold text-white">
                  {num}
                </div>
                <div className="w-12 h-12 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-[#8B5CF6]" />
                </div>
                <h3 className="text-xl font-semibold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
                  {title}
                </h3>
                <p className="text-[#94A3B8]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section
        ref={featuresRef}
        className="py-20 md:py-28"
        style={{ background: 'linear-gradient(180deg, #0A0A0F 0%, #0d0d14 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className={`text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center transition-all duration-700 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Everything Your Business Needs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {[
              { icon: Phone, title: 'Voice AI Booking', desc: 'AI answers calls 24/7. Books real appointments. Sounds natural.' },
              { icon: Languages, title: 'Speaks 70+ languages', desc: "Your AI receptionist automatically detects what language your customer speaks and responds fluently — English, French, Spanish, Arabic, Mandarin, and dozens more. No setup needed." },
              { icon: Calendar, title: 'Calendar Sync', desc: 'Google Calendar & Outlook. Real-time availability. Never double-book.' },
              { icon: MessageSquare, title: 'SMS & Email', desc: 'Instant confirmations to customers via text and email.' },
              { icon: Globe, title: 'Online Booking Page', desc: 'Shareable booking link on your domain. Customers book online anytime.' },
              { icon: Building2, title: 'Multi-Business', desc: 'Manage multiple locations under one account. Up to 5 businesses.' },
              { icon: BarChart3, title: 'Dashboard & Analytics', desc: 'See all bookings, calls, and customer data in one place.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div
                key={title}
                className={`rounded-xl border border-[#1e1e2e] p-6 transition-all duration-300 hover:border-[#8B5CF6]/50 hover:shadow-[0_0_30px_-10px_rgba(139,92,246,0.3)] ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{
                  background: '#12121A',
                  transitionDelay: `${100 + i * 50}ms`,
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2" style={{ fontFamily: "'Sora', sans-serif" }}>
                  {title}
                </h3>
                <p className="text-sm text-[#94A3B8]">{desc}</p>
              </div>
            ))}
          </div>
          <p
            className={`text-center text-[#94A3B8] text-sm max-w-2xl mx-auto mt-14 transition-all duration-700 ${featuresVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <span className="text-[#F8FAFC] font-medium">Available worldwide.</span>{' '}
            From barber shops to dental clinics, fitness studios to spas — Book8 AI runs wherever your business is.
          </p>
        </div>
      </section>

      {/* Booking page preview */}
      <section
        className="py-20 md:py-28"
        style={{ background: '#0A0A0F' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Your Booking Page, Ready to Share
          </h2>
          <p className="text-center text-[#94A3B8] max-w-2xl mx-auto mb-12">
            Every business gets a custom booking link. Share it on social, text it to clients, or embed it on your website.
          </p>
          <div className="max-w-2xl mx-auto rounded-xl overflow-hidden border border-[#1e1e2e] shadow-2xl" style={{ background: '#12121A' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2e] bg-[#0d0d12]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#eab308]" />
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-xs text-[#64748B] bg-[#1e1e2e] px-4 py-1 rounded">
                  book8.io/your-business
                </span>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center text-xs text-[#64748B] py-2">
                    {d}
                  </div>
                ))}
                {['', '', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, '', ''].map((day, i) => {
                  const isSelected = day === 15;
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-full flex items-center justify-center text-sm ${
                        isSelected ? 'bg-[#8B5CF6] text-white' : 'text-[#64748B]'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00'].map((t) => (
                  <div
                    key={t}
                    className="py-2 rounded-lg border border-[#1e1e2e] text-center text-sm font-medium text-white/70"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — all tiers (matches /pricing) */}
      <section
        className="py-20 md:py-28"
        style={{ background: 'linear-gradient(180deg, #0A0A0F 0%, #0d0d14 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Simple Pricing
          </h2>
          <p className="text-center text-[#94A3B8] text-sm max-w-2xl mx-auto mb-12">
            Plans from $29/mo. Growth includes a 14-day free trial (card on file).{' '}
            <Link href="/pricing" className="text-[#8B5CF6] hover:underline">
              Compare details →
            </Link>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-8">
            {[
              {
                planId: 'starter',
                icon: Zap,
                name: 'Starter',
                price: '$29',
                sub: '/month',
                desc: 'Individuals & small businesses',
                cta: 'Get started',
                href: setupUrlWithNewBusiness({ plan: 'starter' }),
                highlight: false,
              },
              {
                planId: 'growth',
                icon: Rocket,
                name: 'Growth',
                price: '$99',
                sub: '/month after trial',
                desc: '14-day free trial · For growing teams',
                cta: 'Start free trial →',
                href: setupUrlWithNewBusiness({ plan: 'growth' }),
                highlight: true,
                badge: 'Most popular',
              },
              {
                planId: 'enterprise',
                icon: Building2,
                name: 'Enterprise',
                price: '$299',
                sub: '/month',
                desc: 'Large teams & custom needs',
                cta: 'Get started',
                href: setupUrlWithNewBusiness({ plan: 'enterprise' }),
                highlight: false,
              },
            ].map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.name}
                  className={`rounded-2xl border p-6 md:p-8 flex flex-col relative ${
                    tier.highlight
                      ? 'border-[#8B5CF6]/60 bg-[#12121A] shadow-[0_0_40px_-12px_rgba(139,92,246,0.4)]'
                      : 'border-[#1e1e2e] bg-[#12121A]'
                  }`}
                >
                  {tier.badge ? (
                    <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide text-[#A78BFA] bg-[#8B5CF6]/20 px-2 py-1 rounded">
                      {tier.badge}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/15 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#A78BFA]" aria-hidden />
                    </div>
                    <h3 className="text-xl font-bold text-[#F8FAFC]">{tier.name}</h3>
                  </div>
                  <p className="text-xs text-[#94A3B8] mb-3 min-h-[2.5rem]">{tier.desc}</p>
                  <p className="text-3xl font-bold text-[#F8FAFC] mb-6">
                    {tier.price}
                    <span className="text-base font-medium text-[#94A3B8]"> {tier.sub}</span>
                  </p>
                  <PricingPlanFeatureList planId={tier.planId} theme="landing" />
                  <Link href={tier.href}>
                    <Button
                      className={`w-full h-11 rounded-lg font-medium ${
                        tier.highlight
                          ? 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
                          : 'bg-[#1e1e2e] hover:bg-[#2a2a3d] text-[#F8FAFC] border border-[#2a2a3d]'
                      }`}
                      size="lg"
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-10 text-center text-xs text-[#94A3B8] max-w-xl mx-auto leading-relaxed px-2">
            {PRICING_CALL_MINUTES_FOOTNOTE}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="py-20 md:py-28"
        style={{ background: '#0A0A0F' }}
      >
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Questions? We&apos;ve got answers.
          </h2>
          <Accordion type="single" collapsible className="mt-12">
            {faqItems.map(({ q, a }) => (
              <AccordionItem
                key={q}
                value={q}
                className="border-[#1e1e2e] px-4 py-2 rounded-lg"
                style={{ background: '#12121A' }}
              >
                <AccordionTrigger className="text-left text-[#F8FAFC] hover:no-underline hover:text-[#8B5CF6]">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-[#94A3B8] pt-2">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="py-24 md:py-32 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139,92,246,0.15), transparent 70%), #0A0A0F',
        }}
      >
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2
            className="text-3xl md:text-5xl font-bold text-[#F8FAFC] mb-6"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            Stop Missing Calls. Start Booking 24/7.
          </h2>
          <Link href={SETUP_NEW_BUSINESS_PATH}>
            <Button
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white h-14 px-10 text-lg rounded-lg font-medium"
              size="lg"
            >
              Get Started Free →
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
