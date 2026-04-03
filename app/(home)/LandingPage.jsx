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
import { SETUP_NEW_BUSINESS_PATH, setupUrlWithNewBusiness } from '@/lib/setup-entry';
import { useBookingLanguage } from '@/hooks/useBookingLanguage';
import { getHomepagePricingDisplay } from '@/lib/translations';

function useIntersectionObserver(ref) {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return isVisible;
}

export default function LandingPage() {
  const { language, t } = useBookingLanguage();
  const h = t.homepage;
  const isRtl = language === 'ar';

  const heroRef = useRef(null);
  const howRef = useRef(null);
  const featuresRef = useRef(null);
  const heroVisible = useIntersectionObserver(heroRef);
  const howVisible = useIntersectionObserver(howRef);
  const featuresVisible = useIntersectionObserver(featuresRef);

  const howCards = [
    { num: 1, icon: Calendar, title: h.step1Title, desc: h.step1Desc },
    { num: 2, icon: Phone, title: h.step2Title, desc: h.step2Desc },
    { num: 3, icon: Check, title: h.step3Title, desc: h.step3Desc },
  ];

  const featureGrid = [
    { icon: Phone, title: h.featVoiceTitle, desc: h.featVoiceDesc },
    { icon: Languages, title: h.featLangTitle, desc: h.featLangDesc },
    { icon: Calendar, title: h.featCalTitle, desc: h.featCalDesc },
    { icon: MessageSquare, title: h.featSmsTitle, desc: h.featSmsDesc },
    { icon: Globe, title: h.featOnlineTitle, desc: h.featOnlineDesc },
    { icon: Building2, title: h.featMultiTitle, desc: h.featMultiDesc },
    { icon: BarChart3, title: h.featDashTitle, desc: h.featDashDesc },
  ];

  const calHeaders = [h.calSun, h.calMon, h.calTue, h.calWed, h.calThu, h.calFri, h.calSat];

  const pricingTiers = [
    {
      planId: 'starter',
      icon: Zap,
      name: h.starter,
      price: '$29',
      sub: h.perMonth,
      desc: h.individualsSmallBiz,
      cta: h.landingGetStarted,
      href: setupUrlWithNewBusiness({ plan: 'starter' }),
      highlight: false,
    },
    {
      planId: 'growth',
      icon: Rocket,
      name: h.growth,
      price: '$99',
      sub: h.monthlyAfterTrial,
      desc: h.landingGrowthCardDesc,
      cta: h.startFreeTrial,
      href: setupUrlWithNewBusiness({ plan: 'growth' }),
      highlight: true,
      badge: h.mostPopular,
    },
    {
      planId: 'enterprise',
      icon: Building2,
      name: h.enterprise,
      price: '$299',
      sub: h.perMonth,
      desc: h.largeTeamsCustom,
      cta: h.landingGetStarted,
      href: setupUrlWithNewBusiness({ plan: 'enterprise' }),
      highlight: false,
    },
  ];

  return (
    <div className="font-landing-body" dir={isRtl ? 'rtl' : 'ltr'} lang={language}>
      <section
        ref={heroRef}
        className="relative min-h-[85vh] flex items-center overflow-hidden"
        style={{ background: '#0A0A0F' }}
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 70% 20%, rgba(139,92,246,0.25), transparent 50%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(6,182,212,0.1), transparent 50%)',
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
                  {h.heroTitle1} {h.heroTitle2}
                </span>
                <span
                  className={`block transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: '100ms' }}
                >
                  {h.heroTitle3} {h.heroTitle4}
                </span>
              </h1>
              <p
                className={`text-lg text-[#94A3B8] max-w-xl leading-relaxed transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '200ms' }}
              >
                {h.heroSubtitle}
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
                    {h.getStartedFree}
                  </Button>
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-[#94A3B8] hover:text-white transition-colors"
                >
                  {h.seeHowItWorks}
                  <ChevronDown aria-hidden className="w-4 h-4 animate-bounce rtl:rotate-180" />
                </a>
              </div>
              <div
                className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-x-6 sm:gap-y-2 text-sm text-[#94A3B8] transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: '400ms' }}
              >
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  {h.answersCallsDay}
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  {h.booksInRealTime}
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  {h.speaks70Languages}
                </span>
                <span className="flex items-center gap-2">
                  <Check aria-hidden className="w-4 h-4 text-[#06B6D4] shrink-0" />
                  {h.smsEmailConfirmations}
                </span>
              </div>
            </div>
            <div
              className={`relative transition-all duration-700 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '300ms' }}
            >
              <div className="rounded-2xl border border-[#1e1e2e] p-8" style={{ background: '#12121A' }}>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center animate-pulse">
                      <Phone className="w-7 h-7 text-[#8B5CF6]" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">{h.phoneRings}</p>
                      <p className="text-sm text-[#94A3B8]">{h.customerCallsYourNumber}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8] rtl:rotate-180" aria-hidden />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-[#06B6D4]" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">{h.aiChecksCalendar}</p>
                      <p className="text-sm text-[#94A3B8]">{h.realTimeAvailability}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ChevronDown className="w-5 h-5 text-[#94A3B8] rtl:rotate-180" aria-hidden />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check className="w-7 h-7 text-green-400" aria-hidden />
                    </div>
                    <div>
                      <p className="font-semibold text-[#F8FAFC]">{h.appointmentBooked}</p>
                      <p className="text-sm text-[#94A3B8]">{h.smsEmailSent}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 border-y border-[#1e1e2e]" style={{ background: '#0A0A0F' }}>
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-center text-[#94A3B8] text-sm">{h.trustedBy}</p>
          <div className="flex flex-wrap justify-center gap-8 mt-4">
            {[
              { icon: Scissors, label: h.barbers },
              { icon: Stethoscope, label: h.dentalClinics },
              { icon: Sparkles, label: h.spas },
              { icon: Dumbbell, label: h.fitnessStudios },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[#64748B]">
                <Icon className="w-5 h-5" aria-hidden />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" ref={howRef} className="py-20 md:py-28" style={{ background: '#0A0A0F' }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className={`text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center transition-all duration-700 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {h.howItWorks}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            {howCards.map(({ num, icon: Icon, title, desc }, i) => (
              <div
                key={num}
                className={`relative rounded-xl border border-[#1e1e2e] p-8 transition-all duration-700 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{
                  background: '#12121A',
                  transitionDelay: `${200 + i * 100}ms`,
                }}
              >
                <div className="absolute -top-3 start-3 w-8 h-8 rounded-full bg-[#8B5CF6] flex items-center justify-center text-sm font-bold text-white">
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
            {h.everythingYouNeed}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {featureGrid.map(({ icon: Icon, title, desc }, i) => (
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
            <span className="text-[#F8FAFC] font-medium">{h.worldwideLead}</span> {h.worldwideRest}
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28" style={{ background: '#0A0A0F' }}>
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {h.yourBookingPage}
          </h2>
          <p className="text-center text-[#94A3B8] max-w-2xl mx-auto mb-12">{h.everyBusinessGets}</p>
          <div
            className="max-w-2xl mx-auto rounded-xl overflow-hidden border border-[#1e1e2e] shadow-2xl"
            style={{ background: '#12121A' }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2e] bg-[#0d0d12]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#eab308]" />
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              </div>
              <div className="flex-1 flex justify-center">
                <span className="text-xs text-[#64748B] bg-[#1e1e2e] px-4 py-1 rounded">{h.mockBrowserUrl}</span>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-7 gap-1 mb-4">
                {calHeaders.map((d) => (
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
                {['9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00'].map((time) => (
                  <div
                    key={time}
                    className="py-2 rounded-lg border border-[#1e1e2e] text-center text-sm font-medium text-white/70"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="py-20 md:py-28"
        style={{ background: 'linear-gradient(180deg, #0A0A0F 0%, #0d0d14 100%)' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {h.simplePricing}
          </h2>
          <p className="text-center text-[#94A3B8] text-sm max-w-2xl mx-auto mb-12">
            {h.plansFrom}{' '}
            <Link href="/pricing" className="text-[#8B5CF6] hover:underline">
              {h.compareDetails}
            </Link>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-8">
            {pricingTiers.map((tier) => {
              const Icon = tier.icon;
              const override = getHomepagePricingDisplay(h, tier.planId);
              return (
                <div
                  key={tier.planId}
                  className={`rounded-2xl border p-6 md:p-8 flex flex-col relative ${
                    tier.highlight
                      ? 'border-[#8B5CF6]/60 bg-[#12121A] shadow-[0_0_40px_-12px_rgba(139,92,246,0.4)]'
                      : 'border-[#1e1e2e] bg-[#12121A]'
                  }`}
                >
                  {tier.badge ? (
                    <span className="absolute top-4 end-4 text-[10px] font-bold uppercase tracking-wide text-[#A78BFA] bg-[#8B5CF6]/20 px-2 py-1 rounded">
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
                  <PricingPlanFeatureList planId={tier.planId} theme="landing" override={override} />
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
            {h.pricingCallFootnote}
          </p>
        </div>
      </section>

      <section className="py-20 md:py-28" style={{ background: '#0A0A0F' }}>
        <div className="mx-auto max-w-3xl px-4">
          <h2
            className="text-3xl md:text-4xl font-bold text-[#F8FAFC] mb-4 text-center"
            style={{ fontFamily: "'Sora', sans-serif" }}
          >
            {h.faqTitle}
          </h2>
          <Accordion type="single" collapsible className="mt-12">
            {h.faq.map(({ q, a }) => (
              <AccordionItem key={q} value={q} className="border-[#1e1e2e] px-4 py-2 rounded-lg" style={{ background: '#12121A' }}>
                <AccordionTrigger className="text-start text-[#F8FAFC] hover:no-underline hover:text-[#8B5CF6]">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-[#94A3B8] pt-2">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section
        className="py-24 md:py-32 relative overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139,92,246,0.15), transparent 70%), #0A0A0F',
        }}
      >
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-[#F8FAFC] mb-6" style={{ fontFamily: "'Sora', sans-serif" }}>
            {h.finalCtaTitle}
          </h2>
          <Link href={SETUP_NEW_BUSINESS_PATH}>
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white h-14 px-10 text-lg rounded-lg font-medium" size="lg">
              {h.getStartedFree}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
