"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import HeaderLogo from "@/components/HeaderLogo";
import { 
  CreditCard, 
  Check, 
  AlertCircle, 
  ExternalLink,
  Zap,
  Rocket,
  Building2,
  ArrowLeft,
  Phone
} from "lucide-react";

const planDetails = {
  starter: { name: "Starter", price: "$29", icon: Zap, color: "from-blue-500 to-cyan-500" },
  growth: { name: "Growth", price: "$99", icon: Rocket, color: "from-brand-500 to-purple-500" },
  enterprise: { name: "Enterprise", price: "$299", icon: Building2, color: "from-orange-500 to-red-500" }
};

export default function BillingSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("book8_token");
      if (t) {
        setToken(t);
      } else {
        router.push("/");
      }
    }
  }, [router]);

  useEffect(() => {
    // Check URL params for success/canceled
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      // Clear the URL param
      window.history.replaceState({}, "", "/dashboard/settings/billing");
    }
    if (searchParams.get("canceled") === "true") {
      setShowCanceled(true);
      window.history.replaceState({}, "", "/dashboard/settings/billing");
    }
  }, [searchParams]);

  useEffect(() => {
    if (token) {
      fetchUserAndPlans();
    }
  }, [token]);

  async function fetchUserAndPlans() {
    setLoading(true);
    try {
      // Fetch user
      const userRes = await fetch("/api/user", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const userData = await userRes.json();
      if (userRes.ok) {
        setUser(userData);
      }

      // Fetch plans
      const plansRes = await fetch("/api/billing/plans", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const plansData = await plansRes.json();
      if (plansData.ok) {
        setPlans(plansData.plans);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId) {
    if (!plans?.[planId]) {
      alert("Plan not available");
      return;
    }

    setUpgradeLoading({ ...upgradeLoading, [planId]: true });

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ priceId: plans[planId] })
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      alert(err.message);
    } finally {
      setUpgradeLoading({ ...upgradeLoading, [planId]: false });
    }
  }

  function getCurrentPlanId() {
    const priceId = user?.subscription?.stripePriceId;
    if (!priceId || !plans) return null;
    
    for (const [planId, planPriceId] of Object.entries(plans)) {
      if (planPriceId === priceId) return planId;
    }
    return null;
  }

  const currentPlanId = getCurrentPlanId();
  const subscription = user?.subscription;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
            <HeaderLogo width={152} height={28} />
          </div>
        </header>
        <div className="container mx-auto max-w-4xl p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo width={152} height={28} />
            <div className="hidden md:block h-6 w-px bg-border" />
            <span className="hidden md:inline text-sm text-muted-foreground">Billing</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl p-6 space-y-6">
        {/* Success/Canceled Messages */}
        {showSuccess && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-500">Subscription activated!</p>
              <p className="text-sm text-green-500/70">Your subscription is now active. Thank you for subscribing!</p>
            </div>
            <button onClick={() => setShowSuccess(false)} className="ml-auto text-green-500/50 hover:text-green-500">
              ×
            </button>
          </div>
        )}

        {showCanceled && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-500">Checkout canceled</p>
              <p className="text-sm text-yellow-500/70">No charges were made. You can try again anytime.</p>
            </div>
            <button onClick={() => setShowCanceled(false)} className="ml-auto text-yellow-500/50 hover:text-yellow-500">
              ×
            </button>
          </div>
        )}

        <h1 className="text-2xl font-bold">Billing & Subscription</h1>

        {/* Current Plan */}
        <Card className="bg-card/50 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isActive && currentPlanId ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {(() => {
                    const plan = planDetails[currentPlanId];
                    const Icon = plan?.icon || Zap;
                    return (
                      <>
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{plan?.name || 'Unknown'} Plan</h3>
                          <p className="text-sm text-muted-foreground">
                            {plan?.price}/month • Status: <span className="text-green-500 capitalize">{subscription.status}</span>
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    Current period ends: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No active subscription</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a plan below to get started with Book8 AI
                </p>
                <Button onClick={() => router.push("/pricing")}>
                  View Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage - Call Minutes */}
        <Card className="bg-card/50 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" /> Call Minutes Usage
            </CardTitle>
            <CardDescription>
              AI phone agent minutes are billed at $0.10 CAD per minute
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm text-muted-foreground">Metered billing</p>
                <p className="text-2xl font-bold">$0.10 <span className="text-sm font-normal text-muted-foreground">/ minute</span></p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Billed monthly</p>
                <p className="text-sm">Usage appears on your invoice</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Plans */}
        {isActive && (
          <Card className="bg-card/50 backdrop-blur border-white/10">
            <CardHeader>
              <CardTitle>Change Plan</CardTitle>
              <CardDescription>Upgrade or change your subscription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(planDetails).map(([planId, plan]) => {
                  const Icon = plan.icon;
                  const isCurrent = planId === currentPlanId;
                  const priceAvailable = plans?.[planId];

                  return (
                    <div
                      key={planId}
                      className={`p-4 rounded-lg border transition-all ${
                        isCurrent 
                          ? "border-brand-500/50 bg-brand-500/5" 
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center mb-3`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <h4 className="font-medium">{plan.name}</h4>
                      <p className="text-2xl font-bold mb-3">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      
                      {isCurrent ? (
                        <div className="flex items-center gap-2 text-sm text-brand-500">
                          <Check className="w-4 h-4" /> Current plan
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => handleUpgrade(planId)}
                          disabled={!priceAvailable || upgradeLoading[planId]}
                        >
                          {upgradeLoading[planId] ? "Processing..." : "Switch to " + plan.name}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manage in Stripe */}
        {isActive && (
          <Card className="bg-card/50 backdrop-blur border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Manage Subscription</h3>
                  <p className="text-sm text-muted-foreground">
                    Update payment method, view invoices, or cancel
                  </p>
                </div>
                <Button variant="outline" onClick={() => window.open("https://billing.stripe.com/p/login/test", "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" /> Stripe Portal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
