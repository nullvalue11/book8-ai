"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Header from "@/components/Header";
import { Check, Zap, Building2, Rocket, ArrowRight } from "lucide-react";

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

export default function PricingPage() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("book8_token");
      if (t) setToken(t);
    }
  }, []);

  async function handleSelectPlan(planId) {
    if (!token) {
      // Redirect to home page with auth section
      router.push("/#auth");
      return;
    }

    setIsLoading({ ...isLoading, [planId]: true });

    try {
      // Get the price ID from env (we'll need to fetch this from an API)
      const res = await fetch("/api/billing/plans", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || "Failed to get plans");
      }

      const priceId = data.plans[planId];
      if (!priceId) {
        throw new Error("Plan not available");
      }

      // Create checkout session
      const checkoutRes = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ priceId })
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutData.ok) {
        throw new Error(checkoutData.error || "Failed to create checkout");
      }

      // Redirect to Stripe Checkout
      window.location.href = checkoutData.checkoutUrl;
    } catch (err) {
      alert(err.message);
    } finally {
      setIsLoading({ ...isLoading, [planId]: false });
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0F14] text-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Choose the plan that&apos;s right for you. All plans include our core
            scheduling features with metered billing for AI call minutes.
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
                  className={`relative bg-card/50 backdrop-blur border-white/10 overflow-hidden transition-all hover:border-white/20 ${
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
                    <CardDescription className="text-white/50">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-white/50">{plan.period}</span>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-white/70">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-gradient-to-r from-brand-500 to-purple-500 hover:from-brand-600 hover:to-purple-600"
                          : "bg-white/10 hover:bg-white/20"
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
                          Get Started <ArrowRight className="w-4 h-4" />
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
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">AI Call Minutes</h2>
          <p className="text-white/60 mb-6">
            All plans include metered billing for AI phone agent calls at
            <span className="text-white font-semibold"> $0.10 CAD per minute</span>.
            Only pay for what you use.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-white/70">Usage tracked automatically</span>
          </div>
        </div>
      </section>

      {/* FAQ or Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center text-white/40 text-sm">
          <p>Questions? Contact us at support@book8.ai</p>
        </div>
      </footer>
    </main>
  );
}
