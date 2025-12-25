"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SubscriptionGate Component
 * 
 * Wraps protected content and redirects to pricing if user is not subscribed.
 * Shows loading state while checking subscription status.
 */
export default function SubscriptionGate({ children, token }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!token) {
      // No token means not logged in - let parent handle
      setLoading(false);
      return;
    }

    async function checkSubscription() {
      try {
        const res = await fetch("/api/billing/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.ok && data.subscribed) {
          setSubscribed(true);
        } else {
          // Redirect to pricing with paywall flag
          router.replace("/pricing?paywall=1");
          return;
        }
      } catch (err) {
        console.error("Subscription check failed:", err);
        // On error, redirect to pricing to be safe
        router.replace("/pricing?paywall=1");
        return;
      } finally {
        setLoading(false);
      }
    }

    checkSubscription();
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Checking subscription...</p>
        </div>
      </div>
    );
  }

  if (!subscribed) {
    // Will redirect, show nothing
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook to check subscription status
 */
export function useSubscription(token) {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function check() {
      try {
        const res = await fetch("/api/billing/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.ok) {
          setSubscribed(data.subscribed);
          setSubscription(data.subscription);
        }
      } catch (err) {
        console.error("Subscription check failed:", err);
      } finally {
        setLoading(false);
      }
    }

    check();
  }, [token]);

  return { loading, subscribed, subscription };
}
