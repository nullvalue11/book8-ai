"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import { Check, Zap, Building2, Rocket, ArrowRight, AlertCircle } from "lucide-react";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for individuals and small businesses getting started",
    icon: Zap,
    features: [
      "Unlimited bookings",
      "Google Calendar sync",
      "Public booking page",
      "Email reminders",
      "Basic analytics",
      "Call minutes: $0.10/min"
    ],
    popular: false,
    color: "from-blue-500 to-cyan-500"
  },
  {
    id: "growth",
    name: "Growth",
    price: "$99",
    period: "/month",
    description: "For growing teams that need more power and flexibility",
    icon: Rocket,
    features: [
      "Everything in Starter",
      "Multiple event types",
      "AI phone agent integration",
      "Advanced analytics",
      "Priority support",
      "Call minutes: $0.10/min",
      "Team collaboration"
    ],
    popular: true,
    color: "from-brand-500 to-purple-500"
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$299",
    period: "/month",
    description: "For large organizations with advanced requirements",
    icon: Building2,
    features: [
      "Everything in Growth",
      "Unlimited team members",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Call minutes: $0.10/min",
      "White-label options",
      "API access"
    ],
    popular: false,
    color: "from-orange-500 to-red-500"
  }
];

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState({});
  const [isPaywall, setIsPaywall] = useState(false);
  const [feature, setFeature] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [sessionSynced, setSessionSynced] = useState(false);

  // Read token from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("book8_token");
      if (t) setToken(t);
    }
  }, []);

  // If we have NextAuth session but no JWT token, sync to get token so API calls work
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
        // ignore
      } finally {
        if (!cancelled) setSessionSynced(true);
      }
    })();
    return () => { cancelled = true; };
  }, [status, session?.user?.email, session?.user?.name, session?.provider, token, sessionSynced]);

  useEffect(() => {
    // Check for paywall mode
    if (searchParams.get("paywall") === "1") {
      setIsPaywall(true);
    }
    // Check for specific feature being blocked
    const blockedFeature = searchParams.get("feature");
    if (blockedFeature) {
      setFeature(blockedFeature);
    }
    // Check for businessId (from business dashboard)
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
      router.push(returnUrl ? `/#auth?callbackUrl=${encodeURIComponent(returnUrl)}` : "/#auth");
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
      alert(err.message);
    } finally {
      setIsLoading((prev) => ({ ...prev, [planId]: false }));
    }
  }

  const featureMessages = {
    calendar: "You need a subscription to connect Google Calendar.",
    phone: "You need a subscription to use AI phone agent features."
  };

  const isLoggedIn = !!token || (status === "authenticated" && session?.user);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Paywall Banner */}
      {isPaywall && isLoggedIn && (
        <div className="bg-brand-500/10 border-b border-brand-500/30">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-brand-500 shrink-0" />
              <div>
                <p className="font-medium text-brand-600 dark:text-brand-400">Subscription Required</p>
                <p className="text-sm text-muted-foreground">
                  {feature && featureMessages[feature] 
                    ? featureMessages[feature] 
                    : "Choose a plan below to unlock all features and start using Book8 AI."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {isPaywall && isLoggedIn ? "Choose Your Plan" : "Simple, transparent pricing"}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {isPaywall && isLoggedIn
              ? "Subscribe to unlock calendar sync, AI phone agents, and all premium features."
              : "Choose the plan that's right for you. All plans include our core scheduling features with metered billing for AI call minutes."}
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative bg-card backdrop-blur border-border overflow-hidden transition-all hover:border-foreground/20 ${
                    plan.popular ? "border-brand-500/50 shadow-[0_0_40px_-12px_rgba(124,77,255,0.3)]" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-brand-500 to-purple-500 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
                      Most Popular
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-muted-foreground">{feat}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600 text-white"
                          : "bg-muted hover:bg-muted/80 text-foreground border border-border"
                      }`}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isLoading[plan.id]}
                    >
                      {isLoading[plan.id] ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {isPaywall && isLoggedIn ? `Subscribe to ${plan.name}` : "Get Started"} <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call Minutes Info */}
      <section className="py-16 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4 text-foreground">AI Call Minutes</h2>
          <p className="text-muted-foreground mb-6">
            All plans include metered billing for AI phone agent calls at
            <span className="text-foreground font-semibold"> $0.10 CAD per minute</span>.
            Only pay for what you use.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">Usage tracked automatically</span>
          </div>
        </div>
      </section>

      {/* FAQ or Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground text-sm">
          <p>Questions? Contact us at support@book8.ai</p>
        </div>
      </footer>
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-background text-foreground">
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
