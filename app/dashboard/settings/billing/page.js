"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import HeaderLogo from "@/components/HeaderLogo";
import { toast } from "sonner";
import { ENABLE_METERED_BILLING_UI } from "@/lib/publicRuntimeConfig";
import CancelSubscriptionModal from "@/components/CancelSubscriptionModal";
import RestoreSubscriptionBanner from "@/components/RestoreSubscriptionBanner";
import { 
  CreditCard, 
  Check, 
  AlertCircle, 
  ExternalLink,
  Zap,
  Rocket,
  Building2,
  ArrowLeft,
  Phone,
  Loader2
} from "lucide-react";

const planDetails = {
  starter: { name: "Starter", price: "$29", icon: Zap, color: "from-blue-500 to-cyan-500" },
  growth: { name: "Growth", price: "$99", icon: Rocket, color: "from-brand-500 to-purple-500" },
  enterprise: { name: "Enterprise", price: "$299", icon: Building2, color: "from-orange-500 to-red-500" }
};

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [cancelModalBusiness, setCancelModalBusiness] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const bizRes = await fetch("/api/business/register", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const bizData = await bizRes.json().catch(() => ({}));
      if (bizRes.ok && Array.isArray(bizData.businesses)) {
        setBusinesses(bizData.businesses);
      } else {
        setBusinesses([]);
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
        body: JSON.stringify({
          priceId: plans[planId],
          ...(businesses.length === 1 &&
          (businesses[0].businessId || businesses[0].id)
            ? {
                businessId: String(
                  businesses[0].businessId || businesses[0].id
                ).trim()
              }
            : {})
        })
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setUpgradeLoading({ ...upgradeLoading, [planId]: false });
    }
  }

  async function openStripePortal() {
    if (!token) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Could not open billing portal");
      }
      window.location.href = data.url;
    } catch (e) {
      toast.error(e?.message || "Portal failed");
    } finally {
      setPortalLoading(false);
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

  function subscriptionStatusLabel(status) {
    const s = String(status || "none").toLowerCase();
    if (s === "active") return "Active";
    if (s === "trialing") return "Trialing";
    if (s === "past_due") return "Past due";
    if (s === "canceled" || s === "cancelled") return "Canceled";
    if (s === "none") return "No subscription";
    return s;
  }

  function businessBillingMeta(b) {
    const sub = b.subscription || {};
    const status = String(sub.status || "none").toLowerCase();
    const hasStripe = !!sub.hasStripeSubscription;
    const ce = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
    const now = new Date();
    const isRestorable = sub.cancelAtPeriodEnd === true && ce && ce > now;
    const canCancel =
      hasStripe &&
      ["active", "trialing", "past_due"].includes(status) &&
      sub.cancelAtPeriodEnd !== true &&
      status !== "canceled" &&
      status !== "cancelled";
    const planKey = sub.plan || b.plan || "starter";
    const plan = planDetails[planKey] || planDetails.starter;
    return { sub, status, hasStripe, ce, isRestorable, canCancel, planKey, plan };
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
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

      {businesses.length > 0 && (
        <Card className="bg-card/50 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Your businesses
            </CardTitle>
            <CardDescription>
              Each business has its own subscription. Cancel or restore per business below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {businesses.map((b) => {
              const { sub, status, isRestorable, canCancel, planKey, plan } = businessBillingMeta(b);
              const Icon = plan?.icon || Building2;
              const periodLabel = sub.currentPeriodEnd
                ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                : "—";
              return (
                <div
                  key={b.businessId || b.id}
                  className="rounded-lg border border-white/10 bg-muted/20 p-4 space-y-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan?.color || "from-gray-500 to-gray-600"} flex items-center justify-center shrink-0`}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{b.name || "Business"}</h3>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          ID: {b.businessId || b.id}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Plan: <span className="text-foreground font-medium">{plan?.name || planKey}</span>{" "}
                          {plan?.price ? `(${plan.price}/mo)` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Status:{" "}
                          <span className="capitalize text-foreground">{subscriptionStatusLabel(sub.status)}</span>
                        </p>
                        {sub.cancelAtPeriodEnd ? (
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            Cancels on {periodLabel}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Next billing: {periodLabel}</p>
                        )}
                      </div>
                    </div>
                    {canCancel && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-white/20"
                        onClick={() => setCancelModalBusiness(b)}
                      >
                        Cancel subscription
                      </Button>
                    )}
                  </div>
                  {isRestorable && (
                    <RestoreSubscriptionBanner
                      businessId={b.businessId || b.id}
                      businessName={b.name}
                      periodEndIso={sub.currentPeriodEnd}
                      token={token}
                      onRestored={fetchUserAndPlans}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

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
                Choose a plan below to get started with Book8-AI
              </p>
              <Button onClick={() => router.push("/pricing")}>
                View Plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {ENABLE_METERED_BILLING_UI && (
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
      )}

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-medium">Manage Subscription</h3>
                <p className="text-sm text-muted-foreground">
                  Update payment method, view invoices, or cancel
                </p>
              </div>
              <Button
                variant="outline"
                onClick={openStripePortal}
                disabled={portalLoading}
                className="w-full sm:w-auto shrink-0 whitespace-nowrap"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Stripe Portal
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <CancelSubscriptionModal
        open={!!cancelModalBusiness}
        business={cancelModalBusiness}
        token={token}
        onClose={() => setCancelModalBusiness(null)}
        onCompleted={fetchUserAndPlans}
      />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    </div>
  );
}

export default function BillingSettingsPage() {
  const router = useRouter();

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

      <Suspense fallback={<LoadingFallback />}>
        <BillingContent />
      </Suspense>
    </main>
  );
}
