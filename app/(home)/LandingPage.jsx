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
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const faqItems = [
  {
    q: 'How does the AI voice agent work?',
    a: 'When a customer calls your Book8 AI number, our AI answers using natural speech. It knows your services, hours, and availability. It has a natural conversation, finds a time that works, and books the appointment.',
  },
  {
    q: 'Do I need any special equipment?',
    a: 'No. We give you a phone number. Customers call it. That\'s it.',
  },
  {
    q: 'Can I use my existing phone number?',
    a: 'Currently we provide a dedicated Book8 AI number. Number porting is coming soon.',
  },
  {
    q: 'What calendars do you support?',
    a: 'Google Calendar and Microsoft Outlook (including Hotmail, Live, and Office 365).',
  },
  {
    q: 'Is there a contract?',
    a: 'No. Monthly billing, cancel anytime.',
  },
];

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
    <div
      className="font-landing-body"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
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
                Customers call your business number. Book8 AI answers, checks your calendar,
                books the appointment, and sends confirmations — automatically, 24/7.
              </p>
              <div
                className={`flex flex-wrap gap-4 transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '300ms' }}
              >
                <Link href="/setup">
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
                  <ChevronDown className="w-4 h-4 animate-bounce" />
                </a>
              </div>
              <div
                className={`flex flex-wrap gap-6 text-sm text-[#94A3B8] transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#06B6D4]" />
                  No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#06B6D4]" />
                  5-minute setup
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#06B6D4]" />
                  Free 14-day trial
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
                      <Phone className="w-7 h-7 text-[#8B5CF6]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">Phone rings</p>
                      <p className="text-sm text-[#94A3B8]">Customer calls your number</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-[#06B6D4]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">AI checks calendar</p>
                      <p className="text-sm text-[#94A3B8]">Real-time availability</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8]" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-7 h-7 text-green-400" />
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
              { icon: Sparkles, label: 'Dental Clinics' },
              { icon: Sparkles, label: 'Spas' },
              { icon: Dumbbell, label: 'Fitness Studios' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-[#64748B]"
              >
                <Icon className="w-5 h-5" />
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
                desc: 'We assign a local phone number with an AI agent trained on your services, hours, and booking rules.',
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
              { icon: Calendar, title: 'Calendar Sync', desc: 'Google Calendar & Outlook. Real-time availability. Never double-book.' },
              { icon: MessageSquare, title: 'SMS & Email', desc: 'Instant confirmations to customers via text and email.' },
              { icon: Globe, title: 'Online Booking Page', desc: 'Shareable link: book8.io/dental-clinic. Customers book online anytime.' },
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
            Every business gets a custom booking page at book8.io/dental-clinic. Share it on Instagram, text it to clients, or add it to your website.
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
                  book8.io/dental-clinic
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
                {['9:00', '10:00', '11:00', '2:00', '3:00', '4:00'].map((t) => (
                  <div
                    key={t}
                    className="py-2 rounded-lg border border-[#1e1e2e] text-center text-sm font-medium"
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
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
          <div className="max-w-md mx-auto mt-12">
            <div className="rounded-2xl border-2 border-[#8B5CF6]/50 p-8" style={{ background: '#12121A' }}>
              <h3 className="text-2xl font-bold text-[#F8FAFC] mb-2">Growth — $99/mo</h3>
              <ul className="space-y-3 text-[#94A3B8] mb-8">
                {['AI voice booking', 'Unlimited bookings', 'Google & Outlook calendar', 'SMS & email confirmations', 'Custom booking page', 'Up to 5 businesses'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#06B6D4] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/setup">
                <Button className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white h-12 rounded-lg font-medium" size="lg">
                  Get Started →
                </Button>
              </Link>
            </div>
          </div>
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
          <Link href="/setup">
            <Button
              className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white h-14 px-10 text-lg rounded-lg font-medium"
              size="lg"
            >
              Get Started Free →
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-12 border-t border-[#1e1e2e]"
        style={{ background: '#0A0A0F' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="font-bold text-[#F8FAFC] mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>
                Book8 AI
              </p>
              <p className="text-sm text-[#94A3B8]">© 2026 Book8 AI Inc.</p>
            </div>
            <div>
              <p className="font-semibold text-[#F8FAFC] mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>
                Product
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/pricing" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Pricing
                </Link>
                <Link href="/#auth" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link href="/setup" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-[#F8FAFC] mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>
                Legal
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/privacy" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
                <Link href="#data-transparency" className="text-sm text-[#94A3B8] hover:text-white transition-colors">
                  Data Usage
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
