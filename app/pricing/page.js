"use client";

import React, { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import PricingPlanFeatureList from "@/components/PricingPlanFeatureList";
import { SETUP_NEW_BUSINESS_PATH, setupUrlWithNewBusiness } from "@/lib/setup-entry";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, Building2, Rocket, ArrowRight, AlertCircle, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useBookingLanguage } from "@/hooks/useBookingLanguage";
import { getHomepagePricingDisplay, trFormat } from "@/lib/translations";

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const { language, t } = useBookingLanguage();
  const h = t.homepage;
  const isRtl = language === "ar";

  const plans = useMemo(
    () => [
      {
        id: "starter",
        name: h.starter,
        price: "$29",
        period: h.perMonth,
        description: h.individualsSmallBiz,
        icon: Zap,
        popular: false,
        color: "from-slate-500 to-slate-400",
        trial: false
      },
      {
        id: "growth",
        name: h.growth,
        price: "$99",
        priceLine: h.moAfterTrial,
        trialHeadline: h.growthTrialHeadline,
        description: h.pricingGrowthBlurb,
        icon: Rocket,
        popular: true,
        color: "from-brand-500 to-purple-500",
        trial: true
      },
      {
        id: "enterprise",
        name: h.enterprise,
        price: "$299",
        period: h.perMonthPerLocation,
        description: h.pricingEnterpriseBlurb,
        icon: Building2,
        popular: false,
        color: "from-slate-600 to-slate-500",
        trial: false
      }
    ],
    [h]
  );

  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState({});
  const [isPaywall, setIsPaywall] = useState(false);
  const [feature, setFeature] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [sessionSynced, setSessionSynced] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tok = localStorage.getItem("book8_token");
      if (tok) setToken(tok);
    }
  }, []);

  useEffect(() => {
    if (sessionSynced || token) return;
    if (status !== "authenticated" || !session?.user?.email) return;

    let cancelled = false;
    (async () => {
      try {
        const syncRes = await fetch("/api/credentials/oauth-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: session.user.email,
            name: session.user.name || "",
            provider: session.provider || "oauth"
          }),
          credentials: "include"
        });
        const syncData = await syncRes.json();
        if (!cancelled && syncData.ok && syncData.token) {
          localStorage.setItem("book8_token", syncData.token);
          localStorage.setItem("book8_user", JSON.stringify(syncData.user));
          setToken(syncData.token);
        }
      } catch (e) {
        /* ignore */
      } finally {
        if (!cancelled) setSessionSynced(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email, session?.user?.name, session?.provider, token, sessionSynced]);

  useEffect(() => {
    if (searchParams.get("paywall") === "1") {
      setIsPaywall(true);
    }
    const blockedFeature = searchParams.get("feature");
    if (blockedFeature) {
      setFeature(blockedFeature);
    }
    const bizId = searchParams.get("businessId");
    if (bizId) {
      setBusinessId(bizId);
    }
  }, [searchParams]);

  const buildReturnUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (searchParams.get("paywall") === "1") params.set("paywall", "1");
    if (businessId) params.set("businessId", businessId);
    const feat = searchParams.get("feature");
    if (feat) params.set("feature", feat);
    const q = params.toString();
    return `/pricing${q ? `?${q}` : ""}`;
  }, [searchParams, businessId]);

  async function handleSelectPlan(planId) {
    const authToken = token || (typeof window !== "undefined" ? localStorage.getItem("book8_token") : null);
    if (!authToken) {
      const returnUrl = buildReturnUrl();
      router.push(returnUrl ? `/setup?redirect=${encodeURIComponent(returnUrl)}` : "/setup");
      return;
    }

    setIsLoading((prev) => ({ ...prev, [planId]: true }));

    try {
      const res = await fetch("/api/billing/plans", {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: "include"
      });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Failed to get plans");
      }

      const priceId = data.plans[planId];
      if (!priceId) {
        throw new Error("Plan not available");
      }

      const checkoutRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        credentials: "include",
        body: JSON.stringify({
          priceId,
          businessId: businessId || undefined
        })
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutData.ok) {
        throw new Error(checkoutData.error || "Failed to create checkout");
      }

      if (checkoutData.checkoutUrl) {
        window.location.href = checkoutData.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err.message || h.toastGenericError);
    } finally {
      setIsLoading((prev) => ({ ...prev, [planId]: false }));
    }
  }

  const featureMessages = {
    calendar: h.needSubCalendar,
    phone: h.needSubPhone,
    services: h.needSubServices,
    analytics: h.needSubAnalytics,
    scheduling: h.needSubScheduling,
    "event-types": h.needSubEventTypes
  };

  const isLoggedIn = !!token || (status === "authenticated" && session?.user);

  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"} lang={language}>
      <Header />

      {isPaywall && isLoggedIn && (
        <div className="bg-brand-500/10 border-b border-brand-500/30">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-brand-500 shrink-0" />
              <div>
                <p className="font-medium text-brand-600 dark:text-brand-400">{h.subscriptionRequired}</p>
                <p className="text-sm text-muted-foreground">
                  {(feature && featureMessages[feature]) || h.needSubGeneric}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {isPaywall && isLoggedIn ? h.pricingHeroChoosePlan : h.pricingHeroSimple}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {isPaywall && isLoggedIn ? h.pricingSubPaywall : h.pricingSubDefault}
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const override = getHomepagePricingDisplay(h, plan.id);
              return (
                <Card
                  key={plan.id}
                  className={`relative bg-card backdrop-blur border-border overflow-hidden transition-all hover:border-foreground/20 ${
                    plan.popular ? "border-brand-500/50 shadow-[0_0_40px_-12px_rgba(124,77,255,0.3)]" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 end-0 bg-gradient-to-r from-brand-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-es-lg">
                      {h.mostPopular}
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    {plan.trial && plan.trialHeadline && (
                      <p className="text-sm font-medium text-brand-600 dark:text-brand-400 mt-1">{plan.trialHeadline}</p>
                    )}
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div>
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground">
                          {plan.trial && plan.priceLine ? plan.priceLine : plan.period}
                        </span>
                      </div>
                    </div>

                    <PricingPlanFeatureList planId={plan.id} override={override} />

                    {plan.id === "growth" && isLoggedIn && isPaywall ? (
                      <Button
                        className="w-full bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600 text-white"
                        disabled={!!isLoading[plan.id]}
                        onClick={() => handleSelectPlan(plan.id)}
                      >
                        {isLoading[plan.id] ? h.loadingEllipsis : h.startFreeTrialShort}{" "}
                        <ArrowRight className="w-4 h-4 inline rtl:rotate-180" />
                      </Button>
                    ) : (
                      <Link
                        href={isLoggedIn ? setupUrlWithNewBusiness({ plan: plan.id }) : SETUP_NEW_BUSINESS_PATH}
                        className="block"
                      >
                        <Button
                          className={`w-full ${
                            plan.popular
                              ? "bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600 text-white"
                              : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                          }`}
                        >
                          {plan.trial && plan.id === "growth"
                            ? h.startFreeTrialShort
                            : isPaywall && isLoggedIn
                              ? trFormat(h.subscribeToPlan, { plan: plan.name })
                              : h.getStartedShort}{" "}
                          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                        </Button>
                      </Link>
                    )}

                    {plan.trial && (
                      <p className="text-xs text-muted-foreground text-center -mt-2 flex items-center justify-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 shrink-0 opacity-80" aria-hidden />
                        {h.trialCardNote}
                      </p>
                    )}
                    {(plan.id === "starter" || plan.id === "enterprise") && (
                      <p className="text-xs text-muted-foreground text-center leading-snug">
                        {plan.id === "starter" ? h.landingStarterPlanNote : h.landingEnterprisePlanNote}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-10 text-center text-xs text-[#94A3B8] dark:text-muted-foreground max-w-xl mx-auto leading-relaxed px-2">
            {h.pricingCallFootnote}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto py-16 px-4">
        <h2 className="text-2xl font-bold text-center mb-8">{h.pricingFaqTitle}</h2>
        <Accordion type="single" collapsible className="w-full">
          {h.faq.map(({ q, a }) => (
            <AccordionItem key={q} value={q} className="border-border">
              <AccordionTrigger className="text-start hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground text-sm">
          <p>
            {h.footerQuestions}{" "}
            <a
              href="mailto:support@book8.io"
              className="underline hover:no-underline text-foreground font-medium"
            >
              support@book8.io
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

function LoadingFallback() {
  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="h-12 w-64 bg-muted rounded mx-auto mb-6 animate-pulse" />
          <div className="h-6 w-96 bg-muted rounded mx-auto animate-pulse" />
        </div>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PricingContent />
    </Suspense>
  );
}
