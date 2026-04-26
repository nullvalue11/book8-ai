"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import HeaderLogo from "./components/HeaderLogo";
import LandingPage from "./(home)/LandingPage";
import { useBookingLanguage } from "@/hooks/useBookingLanguage";
import { trFormat } from "@/lib/translations";
import DataPrivacy from "./(home)/DataPrivacy";
import SocialMediaLinks from "./components/SocialMediaLinks";
import ThemeToggle from "@/components/ThemeToggle";
import { QrCode, Share2, Settings, ExternalLink, Check, Lock, CreditCard, Building2, Sparkles, Crown, Phone, Calendar, Activity, CheckCircle2, XCircle, Loader2, Star, ListTodo, LayoutGrid, LineChart } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import UpgradePrompt from "./components/UpgradePrompt";
import { TrialGateProvider } from "./components/TrialGateProvider";
import PlanFeatureLock from "./components/PlanFeatureLock";
import { getPlanName, getUiPlanLimits, normalizePlanKey } from "./lib/plan-features";
import { bookingLanguageBadge } from "./lib/bookingLanguageDisplay";
import { toast } from "sonner";
import { resolveBusinessPlanKey } from "@/lib/subscription-shared";
import {
  formatBookingDashboardDateTime,
  resolveBusinessTimezoneFromOwnedList
} from "@/lib/bookingDisplayTime";
import { getBookingStartMs, isRecentPastBooking, isUpcomingBooking } from "@/lib/bookingListUtils";
import { buildGoogleConnectUrl } from "@/lib/oauth-connect-url";

function formatDT(dt) { try { return new Date(dt).toLocaleString(); } catch { return dt; } }
function formatDuration(seconds) {
  if (seconds == null) return "—";
  const min = Math.floor(Number(seconds) / 60);
  const sec = Math.floor(Number(seconds) % 60);
  return `${min}m ${sec.toString().padStart(2, "0")}s`;
}
function formatPhone(phone) {
  if (phone == null || String(phone).trim() === "") return "";
  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (raw.startsWith("+")) return raw;
  if (digits.length > 0) return `+${digits}`;
  return raw;
}
function formatCallTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return "—"; }
}

/** ISO-ish codes from calls → short display names for tooltips */
const CALL_LANGUAGE_LABELS = {
  en: "English",
  fr: "French",
  es: "Spanish",
  ar: "Arabic",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  hi: "Hindi",
};

function callLanguageDisplayLabel(code) {
  if (!code) return "";
  const key = String(code).toLowerCase().replace(/_/g, "-").split("-")[0].slice(0, 8);
  if (!/^[a-z]{2,8}$/.test(key)) return String(code).toUpperCase();
  return CALL_LANGUAGE_LABELS[key] || String(code).toUpperCase();
}

/** BOO-45B: display fee from snapshot for confirm dialogs */
function policyFeeDisplayForConfirm(booking) {
  const pol = booking.noShowPolicySnapshot;
  if (!pol || !pol.enabled) return "";
  if (pol.feeType === "percentage") return `${pol.feeAmount ?? 0}%`;
  const cur = String(pol.currency || "cad").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur.length === 3 ? cur : "USD"
    }).format(Number(pol.feeAmount) || 0);
  } catch {
    return String(pol.feeAmount ?? "");
  }
}

/** ElevenLabs / core-api may expose detected language on call payloads */
function callDetectedLanguageCode(call) {
  const raw =
    call.detectedLanguage ||
    call.language ||
    call.elevenLabs?.detectedLanguage ||
    call.elevenLabs?.language ||
    call.elevenLabs?.conversationLanguage ||
    call.transcription?.language ||
    call.metadata?.language;
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const code = s.replace(/_/g, "-").split("-")[0].toLowerCase().slice(0, 8);
  if (!/^[a-z]{2,8}$/.test(code)) return null;
  return code;
}

function ProvisioningAlertBanner({ token, show }) {
  const [needsAttention, setNeedsAttention] = React.useState(false);
  React.useEffect(() => {
    if (!show || !token) return;
    let cancelled = false;
    fetch("/api/admin/provisioning-status", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.businessId && data.overallStatus === "NEEDS_ATTENTION") setNeedsAttention(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [show, token]);
  if (!needsAttention) return null;
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
      <div>
        <span className="font-semibold text-red-600 dark:text-red-400">Provisioning incomplete</span>
        <span className="text-muted-foreground text-sm ml-2">
          Some systems need attention before your phone line is fully operational.
        </span>
      </div>
      <Link
        href="/dashboard/provisioning"
        className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0 hover:underline"
      >
        View status →
      </Link>
    </div>
  );
}

// Confetti helper - dynamically import to avoid SSR issues
async function fireConfetti() {
  try {
    const confetti = (await import('canvas-confetti')).default;
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    // Fire a second burst
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 200);
  } catch (e) {
    console.log('Confetti not available');
  }
}

import { Suspense } from "react";

// Loading fallback for Suspense
function HomeLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full"></div>
    </div>
  );
}

// Main home content component
function HomeContent(props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const businessIdFromUrl = searchParams.get("businessId");
  const forceDashboard = !!props?.forceDashboard;
  const { language, t } = useBookingLanguage();
  const rc = t.recurring || {};

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [appReady, setAppReady] = useState(false);
  
  // Subscription state - enhanced
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [planTier, setPlanTier] = useState('free');
  const [planName, setPlanName] = useState('No plan');
  /** BOO-47: after /api/business/register resolves — drive onboarding redirect */
  const [businessesResolved, setBusinessesResolved] = useState(false);
  const [hasNoBusiness, setHasNoBusiness] = useState(false);
  const [billingSubscription, setBillingSubscription] = useState(null);
  const [features, setFeatures] = useState({});
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);
  const [isSyncingSubscription, setIsSyncingSubscription] = useState(false);

  const detectedTz = useMemo(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } }, []);
  const [timeZone, setTimeZone] = useState(detectedTz);

  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [googleStatus, setGoogleStatus] = useState({ connected: false, lastSyncedAt: null });
  const [outlookStatus, setOutlookStatus] = useState({ connected: false, lastSyncedAt: null });
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [calendars, setCalendars] = useState([]);
  const [savingCalendars, setSavingCalendars] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(null) // null | "google" | "microsoft"
  const [disconnecting, setDisconnecting] = useState(false)

  const [archivedCount, setArchivedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [justCompletedCheckout, setJustCompletedCheckout] = useState(false);
  /** BOO-59B: waiting waitlist entries for dashboard nav badge */
  const [waitlistWaitingCount, setWaitlistWaitingCount] = useState(0);

  const [phoneSetup, setPhoneSetup] = useState(null);
  const [phoneSetupLoading, setPhoneSetupLoading] = useState(false);
  const [primaryBusinessId, setPrimaryBusinessId] = useState(null);
  const [primaryBusinessName, setPrimaryBusinessName] = useState(null);
  const [primaryBookingHandle, setPrimaryBookingHandle] = useState(null);
  const [primaryCalendarProvider, setPrimaryCalendarProvider] = useState(null);

  const [recentCalls, setRecentCalls] = useState([]);
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  /** Recent past bookings (14d) for no-show actions — BOO-45B */
  const [recentPastBookings, setRecentPastBookings] = useState([]);
  const [callSearchQuery, setCallSearchQuery] = useState("");
  const [callSortOrder, setCallSortOrder] = useState("newest");
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingSortOrder, setBookingSortOrder] = useState("newest");
  const [callsLoading, setCallsLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  /** BOO-67B: all businesses for multi-location nav */
  const [ownedBusinesses, setOwnedBusinesses] = useState([]);
  /** BOO-60B: modal listing recurring series */
  const [recurringSeriesOverlay, setRecurringSeriesOverlay] = useState(null);
  const [servicesMap, setServicesMap] = useState({});
  const [expandedCallId, setExpandedCallId] = useState(null);
  const [planLimits, setPlanLimits] = useState(null);
  /** BOO-56: services/hours saved locally during onboarding — push to core when API is ready */
  const [pendingCoreSync, setPendingCoreSync] = useState(false);
  const [coreSyncBusy, setCoreSyncBusy] = useState(false);

  const filteredRecentCalls = useMemo(() => {
    let calls = [...recentCalls];
    const q = callSearchQuery.trim().toLowerCase();
    if (q) {
      calls = calls.filter((call) => {
        const summary = String(call.elevenLabs?.transcriptSummary || call.summary || "").toLowerCase();
        const callerPhone = String(call.callerPhone || call.fromNumber || "").toLowerCase();
        const formatted = String(call.formattedPhone || "").toLowerCase();
        const customerName = String(call.customerName || "").toLowerCase();
        return (
          callerPhone.includes(q) ||
          formatted.includes(q) ||
          customerName.includes(q) ||
          summary.includes(q)
        );
      });
    }
    calls.sort((a, b) => {
      const dateA = new Date(a.startTime || a.createdAt || 0).getTime();
      const dateB = new Date(b.startTime || b.createdAt || 0).getTime();
      return callSortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    return calls;
  }, [recentCalls, callSearchQuery, callSortOrder]);

  const showEnterpriseLocationNav = useMemo(() => {
    if (!forceDashboard || ownedBusinesses.length < 2) return false;
    return ownedBusinesses.some((b) => resolveBusinessPlanKey(b) === "enterprise");
  }, [forceDashboard, ownedBusinesses]);

  /** Primary business row for plan display (trial banner, etc.) — DB plan beats Stripe metadata when they disagree (BOO-74B). */
  const primaryBizForTrialBanner = useMemo(() => {
    if (!ownedBusinesses.length) return null;
    if (primaryBusinessId) {
      return ownedBusinesses.find((b) => b.businessId === primaryBusinessId) || ownedBusinesses[0];
    }
    return ownedBusinesses[0];
  }, [ownedBusinesses, primaryBusinessId]);

  /** BOO-86B: all booking times on the home dashboard use this IANA zone (Mongo `business.timezone`). */
  const businessDisplayTimezone = useMemo(
    () => resolveBusinessTimezoneFromOwnedList(ownedBusinesses, primaryBusinessId),
    [ownedBusinesses, primaryBusinessId]
  );

  const showTrialingPlanBanner = useMemo(() => {
    if (billingSubscription?.status !== "trialing" || !billingSubscription?.trialEnd) return false;
    if (
      primaryBizForTrialBanner &&
      normalizePlanKey(resolveBusinessPlanKey(primaryBizForTrialBanner)) === "enterprise"
    ) {
      return false;
    }
    return true;
  }, [billingSubscription?.status, billingSubscription?.trialEnd, primaryBizForTrialBanner]);

  const trialPlanDisplayName = useMemo(() => {
    if (primaryBizForTrialBanner) {
      return getPlanName(normalizePlanKey(resolveBusinessPlanKey(primaryBizForTrialBanner)));
    }
    return getPlanName(billingSubscription?.plan || planTier || "growth");
  }, [primaryBizForTrialBanner, billingSubscription?.plan, planTier]);

  const filteredUpcomingBookings = useMemo(() => {
    let rows = [...upcomingBookings];
    const q = bookingSearchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((booking) => {
        const customer = String(booking.customer?.name || booking.customerName || "").toLowerCase();
        const phone = String(booking.customer?.phone || booking.customerPhone || "").toLowerCase();
        const serviceName = String(
          servicesMap[booking.serviceId] || booking.serviceName || booking.serviceId || ""
        ).toLowerCase();
        return customer.includes(q) || phone.includes(q) || serviceName.includes(q);
      });
    }
    rows.sort((a, b) => {
      const startA = new Date(a.slot?.start || a.startTime || a.start || 0).getTime();
      const startB = new Date(b.slot?.start || b.startTime || b.start || 0).getTime();
      return bookingSortOrder === "newest" ? startA - startB : startB - startA;
    });
    return rows;
  }, [upcomingBookings, bookingSearchQuery, bookingSortOrder, servicesMap]);

  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [formError, setFormError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // "login" or "register"
  const [showAuth, setShowAuth] = useState(false);
  const fetchAbort = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const t = localStorage.getItem("book8_token");
        const u = localStorage.getItem("book8_user");
        if (t) setToken(t);
        if (u) setUser(JSON.parse(u));
      }
    } finally {
      setAppReady(true);
    }
  }, []);

  // Check for NextAuth OAuth session and sync to our JWT system
  useEffect(() => {
    const syncOAuthSession = async () => {
      // Skip if already logged in with our token
      if (token) return;
      
      try {
        // Check if there's a NextAuth session
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        
        if (session && session.user && session.user.email) {
          console.log('[OAuth] Found NextAuth session, syncing to JWT...');
          
          // Sync the OAuth session to our JWT system
          const syncRes = await fetch('/api/credentials/oauth-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.user.email,
              name: session.user.name,
              provider: session.provider || 'oauth'
            })
          });
          
          const syncData = await syncRes.json();
          
          if (syncData.ok && syncData.token) {
            console.log('[OAuth] JWT sync successful, logging in...');
            localStorage.setItem('book8_token', syncData.token);
            localStorage.setItem('book8_user', JSON.stringify(syncData.user));
            setToken(syncData.token);
            setUser(syncData.user);
            // BOO-47: Do not hard-navigate here — / onboarding effect routes to /setup or /dashboard after business list loads
          }
        }
      } catch (err) {
        console.error('[OAuth] Session sync error:', err);
      }
    };
    
    if (appReady && !token) {
      syncOAuthSession();
    }
  }, [appReady, token]);

  useEffect(() => {
    if (!token) {
      setBusinessesResolved(false);
      setHasNoBusiness(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setWaitlistWaitingCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/business/waitlist", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.ok && typeof data.waitingCount === "number") {
          setWaitlistWaitingCount(data.waitingCount);
        }
      } catch {
        if (!cancelled) setWaitlistWaitingCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Show auth section only when Sign In clicked (#auth) or redirect with #auth
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkHash = () => {
      if (window.location.hash === '#auth') setShowAuth(true);
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // When showAuth becomes true, scroll to sign-in section
  useEffect(() => {
    if (showAuth && !token && typeof window !== 'undefined') {
      const el = document.getElementById('auth');
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [showAuth, token]);

  // BOO-47: Logged-in users on `/` — wait for business list, then setup (no biz) or dashboard
  useEffect(() => {
    if (!appReady || !token || typeof window === 'undefined') return;
    if (window.location.pathname !== '/') return;
    if (!businessesResolved) return;
    try {
      const redirect = searchParams.get('redirect');
      if (hasNoBusiness) {
        const q = new URLSearchParams();
        q.set('newBusiness', '1');
        if (redirect) q.set('redirect', redirect);
        window.location.replace(`/setup?${q.toString()}`);
        return;
      }
      window.location.replace(redirect || '/dashboard');
    } catch {}
  }, [appReady, token, searchParams, businessesResolved, hasNoBusiness]);

  // BOO-47B: /dashboard/* redirect when user has 0 businesses is handled in app/dashboard/layout.js

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) { refreshUser(); fetchBookings(); fetchGoogleStatus(); fetchOutlookStatus(); fetchArchivedCount(); checkSubscription(); } }, [token]);

  // Check for checkout success (from pricing page redirect)
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    
    if (checkoutStatus === 'success' || sessionId) {
      console.log('[Dashboard] Checkout success detected, syncing subscription...');
      setJustCompletedCheckout(true);

      if (token) {
        // First, call the sync endpoint to ensure database is up to date
        // Then check subscription status
        const syncAndCheck = async () => {
          try {
            // Step 1: Call sync endpoint to fetch from Stripe
            console.log('[Dashboard] Calling /api/billing/sync...');
            const syncRes = await fetch('/api/billing/sync', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store'
            });
            const syncData = await syncRes.json();
            console.log('[Dashboard] Sync response:', syncData);
            
            if (syncData.ok && syncData.subscribed) {
              // Sync found active subscription!
              setIsSubscribed(true);
              setPlanTier(syncData.planTier || 'starter');
              setPlanName(syncData.planName || 'Starter');
              setFeatures(syncData.features || {});
              setBillingSubscription(syncData.subscription || null);
              setSubscriptionChecked(true);
              setShowSubscriptionSuccess(true);
              fireConfetti();
              setTimeout(() => setShowSubscriptionSuccess(false), 5000);
              console.log('[Dashboard] Subscription synced and confirmed!');
              return;
            }
            
            // Step 2: If sync didn't find it, retry a few times
            // Stripe might take a moment to process
            let attempts = 0;
            const maxAttempts = 5;
            
            const checkWithRetry = async () => {
              attempts++;
              console.log(`[Dashboard] Subscription check attempt ${attempts}/${maxAttempts}`);
              
              // Try sync again
              const retryRes = await fetch('/api/billing/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
              });
              const retryData = await retryRes.json();
              
              if (retryData.ok && retryData.subscribed) {
                setIsSubscribed(true);
                setPlanTier(retryData.planTier || 'starter');
                setPlanName(retryData.planName || 'Starter');
                setFeatures(retryData.features || {});
                setBillingSubscription(retryData.subscription || null);
                setSubscriptionChecked(true);
                setShowSubscriptionSuccess(true);
                fireConfetti();
                setTimeout(() => setShowSubscriptionSuccess(false), 5000);
                console.log('[Dashboard] Subscription confirmed on retry!');
              } else if (attempts < maxAttempts) {
                console.log('[Dashboard] Not subscribed yet, retrying in 2s...');
                setTimeout(checkWithRetry, 2000);
              } else {
                console.log('[Dashboard] Max attempts reached');
                setSubscriptionChecked(true);
              }
            };
            
            setTimeout(checkWithRetry, 2000);
            
          } catch (err) {
            console.error('[Dashboard] Sync error:', err);
            setSubscriptionChecked(true);
          }
        };
        
        syncAndCheck();
      }
      
      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, token]);

  // After checkout success, guide user into phone setup wizard
  useEffect(() => {
    if (justCompletedCheckout && token) {
      try {
        router.push('/setup');
      } catch {}
    }
  }, [justCompletedCheckout, token, router]);

  // Manual subscription sync function
  async function syncSubscription() {
    setIsSyncingSubscription(true);
    try {
      console.log('[Dashboard] Manual sync triggered');
      const res = await fetch('/api/billing/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json();
      console.log('[Dashboard] Sync response:', data);
      
      if (data.ok && data.subscribed) {
        setIsSubscribed(true);
        setPlanTier(data.planTier || 'starter');
        setPlanName(data.planName || 'Starter');
        setFeatures(data.features || {});
        setBillingSubscription(data.subscription || null);
        setShowSubscriptionSuccess(true);
        fireConfetti();
        setTimeout(() => setShowSubscriptionSuccess(false), 5000);
      } else if (data.ok) {
        setBillingSubscription(null);
        toast.info(data.message || 'No active subscription found');
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch (err) {
      console.error('[Dashboard] Sync error:', err);
      toast.error('Failed to sync subscription: ' + err.message);
    } finally {
      setIsSyncingSubscription(false);
    }
  }

  // Check subscription status
  async function checkSubscription(showSuccessOnActive = false) {
    try {
      const res = await fetch('/api/billing/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.ok) {
        setIsSubscribed(data.subscribed);
        setPlanTier(data.planTier || 'free');
        setPlanName(data.planName || (data.subscribed ? 'Free' : 'No plan'));
        setFeatures(data.features || {});
        setBillingSubscription(data.subscription || null);
        
        // Show success message and confetti if just subscribed
        if (showSuccessOnActive && data.subscribed) {
          setShowSubscriptionSuccess(true);
          fireConfetti();
          // Auto-hide after 5 seconds
          setTimeout(() => setShowSubscriptionSuccess(false), 5000);
        }
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
    } finally {
      setSubscriptionChecked(true);
    }
  }

  const api = useCallback(async (path, opts = {}) => {
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {}, token ? { Authorization: `Bearer ${token}` } : {});
    const res = await fetch(`/api${path}`, { ...opts, headers });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) throw new Error(body?.error || body || `Request failed: ${res.status}`);
    return body;
  }, [token]);

  async function refreshUser() {
    const controller = new AbortController();
    fetchAbort.current = controller;
    try {
      const req = fetch('/api/user', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
      const res = await req;
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load user');
      setUser(data);
    } catch {}
  }

  async function fetchBookings() { try { setLoadingBookings(true); const list = await api(`/bookings`, { method: "GET" }); setBookings(list || []); } catch {} finally { setLoadingBookings(false); } }
  async function fetchArchivedCount() { try { const items = await api(`/bookings/archived`, { method: "GET" }); setArchivedCount((items || []).length); } catch {} }

  async function refetchUpcomingBookings() {
    if (!token || !primaryBusinessId) return;
    try {
      const [bookingsRes, svcRes] = await Promise.all([
        fetch(`/api/business/${encodeURIComponent(primaryBusinessId)}/bookings`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch(`/api/business/${encodeURIComponent(primaryBusinessId)}/services`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
      ]);
      const sMap = {};
      const svcList = svcRes?.services ?? (Array.isArray(svcRes) ? svcRes : []);
      (Array.isArray(svcList) ? svcList : []).forEach((s) => {
        if (s && (s.serviceId != null || s.slug != null)) {
          const key = (s.serviceId ?? s.slug ?? "").toString();
          sMap[key] = s.name || s.serviceId || s.slug || "Appointment";
        }
      });
      setServicesMap(sMap);
      const list = bookingsRes?.bookings ?? (bookingsRes?.ok ? [] : []);
      const now = new Date();
      const nowMs = now.getTime();
      const ms14d = 14 * 24 * 3600000;
      const pastCutoff = nowMs - ms14d;
      const upcoming = (Array.isArray(list) ? list : [])
        .filter((b) => isUpcomingBooking(b, nowMs))
        .sort((a, b) => (getBookingStartMs(a) || 0) - (getBookingStartMs(b) || 0))
        .slice(0, 10);
      setUpcomingBookings(upcoming);
      const pastRecent = (Array.isArray(list) ? list : [])
        .filter((b) => isRecentPastBooking(b, nowMs, pastCutoff))
        .sort((a, b) => (getBookingStartMs(b) || 0) - (getBookingStartMs(a) || 0))
        .slice(0, 25);
      setRecentPastBookings(pastRecent);
    } catch (err) {
      console.error("[refetchUpcomingBookings]", err);
    }
  }

  async function loadRecurringSeries(seriesId) {
    if (!token || !primaryBusinessId || !seriesId) return;
    setRecurringSeriesOverlay({ loading: true, seriesId, bookings: [] });
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(primaryBusinessId)}/recurring-series?seriesId=${encodeURIComponent(seriesId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRecurringSeriesOverlay({
        loading: false,
        seriesId,
        bookings: Array.isArray(data.bookings) ? data.bookings : [],
      });
    } catch (e) {
      setRecurringSeriesOverlay(null);
      toast.error(e.message || "Failed");
    }
  }

  async function recurringDashboardAction(action, bookingId) {
    if (!token || !primaryBusinessId || !bookingId) return;
    const msg = action === "cancel_one" ? rc.cancelThisOnly : rc.cancelAllFuture;
    if (typeof window !== "undefined" && !window.confirm(msg || "Continue?")) return;
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(primaryBusinessId)}/recurring-series`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, bookingId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Updated");
      setRecurringSeriesOverlay(null);
      await refetchUpcomingBookings();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  }

  async function markBookingNoShow(booking) {
    if (!token || !primaryBusinessId) return;
    const id = booking.id || booking.bookingId;
    if (!id) return;
    const feeHint = policyFeeDisplayForConfirm(booking);
    const msg = feeHint
      ? `${t.noShow.confirmMarkNoShow}\n${trFormat(t.noShow.confirmMarkNoShowAuto, { amount: feeHint })}`
      : t.noShow.confirmMarkNoShow;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(primaryBusinessId)}/bookings/${encodeURIComponent(id)}/mark-no-show`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      toast.success("Updated");
      await refetchUpcomingBookings();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  }

  async function chargeBookingNoShow(booking) {
    if (!token || !primaryBusinessId) return;
    const id = booking.id || booking.bookingId;
    if (!id) return;
    const customer = booking.customer?.name || booking.customerName || "Guest";
    const amountStr =
      booking.noShowChargeAmountCents != null
        ? new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" }).format(
            booking.noShowChargeAmountCents / 100
          )
        : policyFeeDisplayForConfirm(booking) || "—";
    if (
      !window.confirm(
        trFormat(t.noShow.confirmChargeNoShow, { name: customer, amount: amountStr })
      )
    )
      return;
    try {
      const res = await fetch(
        `/api/business/${encodeURIComponent(primaryBusinessId)}/bookings/${encodeURIComponent(id)}/charge-no-show`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Charge failed");
      toast.success("Charged");
      await refetchUpcomingBookings();
    } catch (e) {
      toast.error(e.message || "Failed");
    }
  }

  async function fetchGoogleStatus() { try { const status = await api(`/integrations/google/sync`, { method: "GET" }); setGoogleStatus(status || { connected: false, lastSyncedAt: null }); } catch { setGoogleStatus({ connected: false, lastSyncedAt: null }); } }
  async function fetchOutlookStatus() { try { const status = await api(`/integrations/microsoft/status`, { method: "GET" }); setOutlookStatus(status || { connected: false, lastSyncedAt: null }); } catch { setOutlookStatus({ connected: false, lastSyncedAt: null }); } }
  async function connectGoogle() { 
    if (!token) {
      toast.error("Please login first");
      return;
    }
    if (!isSubscribed) {
      router.push('/pricing?paywall=1&feature=calendar');
      return;
    }
    if (!primaryBusinessId) {
      toast.error("Select or create a business first so Google Calendar links to that business.");
      return;
    }
    window.location.href = buildGoogleConnectUrl({ jwt: token, businessId: primaryBusinessId });
  }
  async function connectOutlook() { 
    if (!token) {
      toast.error("Please login first");
      return;
    }
    if (!isSubscribed) {
      router.push('/pricing?paywall=1&feature=calendar');
      return;
    }
    if (planLimits && planLimits.outlookCalendar === false) {
      router.push('/pricing?paywall=1&feature=calendar');
      return;
    }
    if (!primaryBusinessId) {
      toast.error('Set up a business first (need a businessId to connect Outlook for phone bookings).');
      return;
    }
    window.location.href = `/api/integrations/microsoft/auth?jwt=${token}&businessId=${primaryBusinessId}`; 
  }
  async function openCalendars() {
    try {
      const res = await api(`/integrations/google/calendars`, { method: "GET" });
      setCalendars(res?.calendars || []);
      setCalendarDialogOpen(true);
    } catch (err) {
      toast.error(err.message || "Failed to load calendars");
    }
  }
  async function saveCalendars() {
    try {
      setSavingCalendars(true);
      const selected = calendars.filter((c) => c.selected).map((c) => c.id);
      await api(`/integrations/google/calendars`, {
        method: "POST",
        body: JSON.stringify({ selectedCalendarIds: selected })
      });
      setCalendarDialogOpen(false);
      await fetchGoogleStatus();
      toast.success("Calendar selection saved");
    } catch (err) {
      toast.error(err.message || "Failed to save selections");
    } finally {
      setSavingCalendars(false);
    }
  }
  async function syncGoogle() {
    try {
      const res = await api(`/integrations/google/sync`, { method: "POST" });
      toast.success(`Synced: created=${res.created}, updated=${res.updated}, deleted=${res.deleted}`);
      await fetchGoogleStatus();
    } catch (err) {
      toast.error(err.message || "Sync failed");
    }
  }

  async function confirmDisconnect() {
    if (!disconnectConfirm) return
    setDisconnecting(true)
    try {
      const res = await api(`/integrations/${disconnectConfirm}/disconnect`, { method: "POST" })
      if (!res?.ok) throw new Error(res?.error || "Disconnect failed")
      if (disconnectConfirm === "google") {
        setGoogleStatus({ connected: false, lastSyncedAt: null })
      } else {
        setOutlookStatus({ connected: false, lastSyncedAt: null })
      }
      setPrimaryCalendarProvider(null)
      toast.success("Calendar disconnected")
    } catch (err) {
      toast.error(err.message || "Disconnect failed")
    } finally {
      setDisconnecting(false)
      setDisconnectConfirm(null)
    }
  }

  // Load primary business phone setup status for dashboard card
  const fetchPhoneSetupStatus = useCallback(async () => {
    if (!token) return;
    try {
      setPhoneSetupLoading(true);
      setBusinessesResolved(false);
      const bizRes = await api(`/business/register`, { method: "GET" });
      const businesses = bizRes.businesses || [];
      setOwnedBusinesses(businesses);
      setHasNoBusiness(businesses.length === 0);
      setBusinessesResolved(true);
      if (!businesses.length) {
        setOwnedBusinesses([]);
        setPrimaryBusinessId(null);
        setPrimaryBusinessName(null);
        setPrimaryBookingHandle(null);
        setPrimaryCalendarProvider(null);
        setPhoneSetup(null);
        setPendingCoreSync(false);
        return;
      }
      const preferred =
        businessIdFromUrl && businesses.find((b) => b.businessId === businessIdFromUrl);
      const primary = preferred || businesses[0];
      setPrimaryBusinessId(primary.businessId);
      setPrimaryBusinessName(primary.name?.trim() || null);
      setPrimaryBookingHandle(primary.handle || primary.businessId || null);
      const provider = primary?.calendar?.provider || (!primary?.calendar?.provider && primary?.calendar?.connected ? 'google' : null)
      setPrimaryCalendarProvider(provider);
      const planKey = normalizePlanKey(
        primary.subscriptionPlan || primary.plan || primary.subscription?.plan
      );
      setPlanLimits(primary.planLimits || getUiPlanLimits(planKey));
      setPendingCoreSync(!!primary.pendingCoreSync);
      const setupRes = await api(
        `/business/phone-setup?businessId=${encodeURIComponent(primary.businessId)}`,
        { method: "GET" }
      );
      setPhoneSetup({
        businessId: primary.businessId,
        name: primary.name,
        forwardingEnabled: setupRes.forwardingEnabled,
        forwardingFrom: setupRes.forwardingFrom,
        assignedTwilioNumber: setupRes.assignedTwilioNumber,
        numberSetupMethod: setupRes.numberSetupMethod
      });
    } catch (err) {
      console.error('[Dashboard] Failed to load phone setup status:', err);
      setOwnedBusinesses([]);
      setPhoneSetup(null);
      setHasNoBusiness(false);
      setBusinessesResolved(true);
      setPendingCoreSync(false);
    } finally {
      setPhoneSetupLoading(false);
    }
  }, [token, api, businessIdFromUrl]);

  useEffect(() => {
    if (token) {
      fetchPhoneSetupStatus();
    }
  }, [token, fetchPhoneSetupStatus]);

  const runCoreSyncRetry = useCallback(async () => {
    if (!token || !primaryBusinessId) return;
    setCoreSyncBusy(true);
    try {
      await fetch(`/api/business/${encodeURIComponent(primaryBusinessId)}/sync-to-core`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
    } catch {
      /* refresh below re-reads pending flags */
    } finally {
      setCoreSyncBusy(false);
      await fetchPhoneSetupStatus();
    }
  }, [token, primaryBusinessId, fetchPhoneSetupStatus]);

  useEffect(() => {
    if (!token || !primaryBusinessId || !pendingCoreSync) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await runCoreSyncRetry();
    };
    void tick();
    const id = setInterval(tick, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, primaryBusinessId, pendingCoreSync, runCoreSyncRetry]);

  // Fetch recent calls for primary business
  useEffect(() => {
    const businessId = primaryBusinessId;
    if (!token || !businessId) {
      setRecentCalls([]);
      setCallsLoading(false);
      return;
    }
    let cancelled = false;
    setCallsLoading(true);
    fetch(`/api/business/${encodeURIComponent(businessId)}/calls`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list = data?.calls ?? (data?.ok ? [] : []);
        const sorted = (Array.isArray(list) ? list : [])
          .sort((a, b) => new Date(b.startTime || b.createdAt || 0) - new Date(a.startTime || a.createdAt || 0))
          .slice(0, 10);
        setRecentCalls(sorted);
      })
      .catch(() => { if (!cancelled) setRecentCalls([]); })
      .finally(() => { if (!cancelled) setCallsLoading(false); });
    return () => { cancelled = true; };
  }, [token, primaryBusinessId]);

  // Fetch upcoming bookings and services together (servicesMap used for service names in booking cards)
  useEffect(() => {
    const businessId = primaryBusinessId;
    if (!token || !businessId) {
      setUpcomingBookings([]);
      setRecentPastBookings([]);
      setServicesMap({});
      setBookingsLoading(false);
      return;
    }
    let cancelled = false;
    setBookingsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`/api/business/${encodeURIComponent(businessId)}/bookings`, { headers }).then((r) => r.json()),
      fetch(`/api/business/${encodeURIComponent(businessId)}/services`, { headers }).then((r) => r.json())
    ])
      .then(([bookingsData, svcData]) => {
        if (cancelled) return;
        const sMap = {};
        const svcList = svcData?.services ?? (Array.isArray(svcData) ? svcData : []);
        (Array.isArray(svcList) ? svcList : []).forEach((s) => {
          if (s && (s.serviceId != null || s.slug != null)) {
            const key = (s.serviceId ?? s.slug ?? "").toString();
            sMap[key] = s.name || s.serviceId || s.slug || "Appointment";
          }
        });
        setServicesMap(sMap);
        const list = bookingsData?.bookings ?? (bookingsData?.ok ? [] : []);
        const now = new Date();
        const nowMs = now.getTime();
        const ms14d = 14 * 24 * 3600000;
        const pastCutoff = nowMs - ms14d;
        const upcoming = (Array.isArray(list) ? list : [])
          .filter((b) => isUpcomingBooking(b, nowMs))
          .sort((a, b) => (getBookingStartMs(a) || 0) - (getBookingStartMs(b) || 0))
          .slice(0, 10);
        setUpcomingBookings(upcoming);
        const pastRecent = (Array.isArray(list) ? list : [])
          .filter((b) => isRecentPastBooking(b, nowMs, pastCutoff))
          .sort((a, b) => (getBookingStartMs(b) || 0) - (getBookingStartMs(a) || 0))
          .slice(0, 25);
        setRecentPastBookings(pastRecent);
      })
      .catch(() => {
        if (!cancelled) {
          setUpcomingBookings([]);
          setRecentPastBookings([]);
          setServicesMap({});
        }
      })
      .finally(() => {
        if (!cancelled) setBookingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [token, primaryBusinessId]);

  function handleLogout() {
    // Abort any pending fetches
    if (fetchAbort.current) try { fetchAbort.current.abort(); } catch {}
    // Clear credential storage so dashboard won't think we're logged in
    if (typeof window !== "undefined") {
      localStorage.removeItem("book8_token");
      localStorage.removeItem("book8_user");
    }
    // Clear local state
    setToken(null);
    setUser(null);
    setBookings([]);
    setIsSubscribed(false);
    setPlanTier("free");
    setPlanName("No plan");
    setFeatures({});
    setSubscriptionChecked(false);
    // Clear NextAuth session and redirect home (otherwise syncOAuthSession on "/" can log us back in)
    signOut({ callbackUrl: "/" });
  }

  async function handleLogin() {
    if (!formData.email || !formData.password) {
      setFormError("Please enter both email and password");
      return;
    }
    try {
      setFormError("");
      setIsLoading(true);
      const res = await fetch('/api/credentials/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('book8_token', data.token);
      localStorage.setItem('book8_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setFormData({ email: "", password: "", name: "" });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister() {
    if (!formData.email || !formData.password) {
      setFormError("Please enter both email and password");
      return;
    }
    if (formData.password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    try {
      setFormError("");
      setIsLoading(true);
      const res = await fetch('/api/credentials/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email, 
          password: formData.password,
          name: formData.name || ""
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('book8_token', data.token);
      localStorage.setItem('book8_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setFormData({ email: "", password: "", name: "" });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  /** Prefer handle from business documents (BOO-74A); legacy user.scheduling.handle was email-derived. */
  const bookingHandle = primaryBookingHandle || user?.scheduling?.handle;
  function copyBookingLink() {
    if (!bookingHandle) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/b/${bookingHandle}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(err => toast.error('Failed to copy: ' + err.message));
  }

  function shareBookingLink(platform) {
    if (!bookingHandle) return;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${baseUrl}/b/${bookingHandle}`;
    const text = 'Book time with me';
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      email: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`
    };
    if (urls[platform]) window.open(urls[platform], '_blank', 'width=600,height=400');
  }

  if (!appReady) {
    return (
      <main id="main-content" className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="h-6 w-24 bg-muted rounded" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-muted" />
              <div className="h-8 w-20 rounded bg-muted" />
            </div>
          </div>
        </header>
        <div className="container mx-auto max-w-6xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 rounded-lg bg-muted" />
            <div className="h-64 rounded-lg bg-muted lg:col-span-2" />
          </div>
        </div>
      </main>
    );
  }

  if (token && !businessesResolved && (forceDashboard || pathname === '/')) {
    return <HomeLoading />;
  }

  if (!token && !forceDashboard) {
    return (
      <>
        <LandingPage />

        {showAuth && (
        <section id="auth" className="container mx-auto max-w-md px-6 py-16" style={{ background: '#0A0A0F' }}>
          <Card className="bg-[#12121A] backdrop-blur border-[#1e1e2e]">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold text-center">
                {authMode === "login" ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <p className="text-sm text-muted-foreground text-center">
                {authMode === "login" 
                  ? "Sign in to manage your bookings" 
                  : "Get started with Book8-AI today"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* OAuth Social Login Buttons */}
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const redirect = searchParams.get('redirect');
                      await signIn('google', { 
                        callbackUrl: redirect ? `/auth/oauth-callback?redirect=${encodeURIComponent(redirect)}` : '/auth/oauth-callback',
                        redirect: true
                      });
                    } catch (err) {
                      console.error('[OAuth] Google sign-in error:', err);
                      setFormError('Failed to initiate Google sign-in. Please try again.');
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const redirect = searchParams.get('redirect');
                      await signIn('azure-ad', { 
                        callbackUrl: redirect ? `/auth/oauth-callback?redirect=${encodeURIComponent(redirect)}` : '/auth/oauth-callback',
                        redirect: true
                      });
                    } catch (err) {
                      console.error('[OAuth] Microsoft sign-in error:', err);
                      setFormError('Failed to initiate Microsoft sign-in. Please try again.');
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 23 23">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Continue with Microsoft
                </Button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-card text-muted-foreground">or continue with email</span>
                </div>
              </div>

              {/* Auth Mode Tabs */}
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                <button
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMode === "login" 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setAuthMode("login"); setFormError(""); }}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authMode === "register" 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setAuthMode("register"); setFormError(""); }}
                >
                  Register
                </button>
              </div>

              {/* Name field (only for register) */}
              {authMode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      setFormError("");
                    }}
                    className="bg-background/50"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setFormError("");
                  }}
                  className="bg-background/50"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setFormError("");
                  }}
                  className="bg-background/50"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                />
                {authMode === "login" && (
                  <div className="text-right mt-1">
                    <Link
                      href="/reset-password/request"
                      className="text-sm text-brand-500 hover:text-brand-400"
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
                {authMode === "register" && (
                  <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}

              <Button 
                className="w-full bg-brand-500 hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500" 
                onClick={authMode === "login" ? handleLogin : handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {authMode === "login" ? "Signing in..." : "Creating account..."}
                  </span>
                ) : (
                  authMode === "login" ? "Sign In" : "Create Account"
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {authMode === "login" ? (
                  <p>
                    Don&apos;t have an account?{" "}
                    <Link href="/setup" className="text-brand-500 hover:text-brand-400 font-medium">
                      Get started
                    </Link>
                    {" · "}
                    <button
                      type="button"
                      className="text-brand-500 hover:text-brand-400 font-medium"
                      onClick={() => { setAuthMode("register"); setFormError(""); }}
                    >
                      Register
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{" "}
                    <button 
                      className="text-brand-500 hover:text-brand-400 font-medium"
                      onClick={() => { setAuthMode("login"); setFormError(""); }}
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
        )}

        {/* Data Privacy Section - after login */}
        <DataPrivacy />

        {/* Footer — light + dark readable (guest home below LandingPage) */}
        <footer className="mt-16 border-t border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-transparent">
          <div className="container mx-auto max-w-6xl px-6 py-8">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
                    <span className="text-xs font-bold text-white">B8</span>
                  </div>
                  <span className="font-medium text-slate-800 dark:text-white/80">Book8-AI</span>
                </div>
                <nav
                  aria-label="Footer"
                  className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4 text-sm"
                >
                  <Link
                    href="/pricing"
                    className="text-slate-600 transition-colors hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/privacy"
                    className="text-slate-600 transition-colors hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    href="/terms"
                    className="text-slate-600 transition-colors hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
                  >
                    Terms &amp; Conditions
                  </Link>
                  <Link
                    href="#data-transparency"
                    className="text-slate-600 transition-colors hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
                  >
                    Data Usage
                  </Link>
                  <span className="hidden h-4 w-px shrink-0 bg-slate-300 sm:block dark:bg-white/20" aria-hidden />
                  <SocialMediaLinks />
                </nav>
              </div>
              <p className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-white/5 dark:text-white/40">
                © {new Date().getFullYear()} Book8. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <HeaderLogo className="opacity-90 hover:opacity-100 transition" />
            <div className="hidden md:block h-6 w-px bg-border"></div>
            <span className="hidden md:inline text-sm text-muted-foreground">Dashboard</span>
            {primaryBusinessName ? (
              <span className="hidden md:inline text-sm font-medium text-foreground truncate max-w-[220px] border-l border-border pl-3" title={primaryBusinessName}>
                {primaryBusinessName}
              </span>
            ) : null}
            {/* Plan badge (trial status uses banner below to avoid duplicate copy) */}
            {subscriptionChecked && isSubscribed && billingSubscription?.status !== 'trialing' && (
              <span className={`inline px-2 py-0.5 rounded-full text-xs md:text-sm font-medium ${
                planTier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                planTier === 'growth' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {planTier === 'enterprise' && <Crown className="w-3 h-3 inline mr-1" />}
                {planName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ThemeToggle />
            <span className="text-muted-foreground hidden sm:inline truncate max-w-[200px]">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      {showEnterpriseLocationNav ? (
        <div className="border-b border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-2 flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/locations"
              className={`inline-flex items-center gap-1.5 text-sm px-2 py-1 rounded-md ${
                pathname === "/dashboard/locations"
                  ? "font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden />
              All Locations
            </Link>
            {ownedBusinesses.map((b) => {
              const active = primaryBusinessId === b.businessId;
              return (
                <Link
                  key={b.businessId}
                  href={`/dashboard?businessId=${encodeURIComponent(b.businessId)}`}
                  className={`inline-flex items-center gap-1.5 text-sm px-2 py-1 rounded-md max-w-[220px] ${
                    active
                      ? "font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  <span className="truncate">{b.name?.trim() || b.businessId}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {showTrialingPlanBanner && (
        <div className="border-b border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-background to-cyan-500/10">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-300">
                {billingSubscription.trialDaysLeft != null
                  ? `Free Trial — ${billingSubscription.trialDaysLeft} day${billingSubscription.trialDaysLeft !== 1 ? 's' : ''} left`
                  : 'Free Trial — Trial active'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Your {trialPlanDisplayName} plan trial ends on{' '}
                {new Date(billingSubscription.trialEnd).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
                . You won&apos;t be charged until then.
              </p>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0" asChild>
              <Link href="/dashboard/settings/billing">View billing</Link>
            </Button>
          </div>
        </div>
      )}

      {billingSubscription?.status === 'past_due' && (
        <div className="border-b border-red-500/30 bg-red-500/10">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-foreground">
              <span className="font-semibold text-red-600 dark:text-red-400">Payment failed</span>
              <span className="text-muted-foreground ml-2">
                We couldn&apos;t charge your card. Update your payment method so your AI receptionist keeps running.
              </span>
            </p>
            <Link
              href="/dashboard/settings/billing"
              className="text-sm font-semibold text-red-600 dark:text-red-400 shrink-0 hover:underline"
            >
              Update payment →
            </Link>
          </div>
        </div>
      )}

      {pendingCoreSync && primaryBusinessId && (
        <div className="border-b border-amber-500/35 bg-amber-500/10">
          <div className="mx-auto max-w-6xl px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-foreground flex items-start gap-2">
              {coreSyncBusy ? (
                <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-amber-600 dark:text-amber-400" aria-hidden />
              ) : (
                <Activity className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
              )}
              <span>
                <span className="font-semibold text-amber-800 dark:text-amber-200">Syncing your booking profile</span>
                <span className="text-muted-foreground block sm:inline sm:ml-2">
                  Services and hours are being copied to our live booking API. Public booking will fill in once this finishes—we retry automatically.
                </span>
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-600/40 text-amber-900 dark:text-amber-100"
              disabled={coreSyncBusy}
              onClick={() => void runCoreSyncRetry()}
            >
              {coreSyncBusy ? "Syncing…" : "Retry sync"}
            </Button>
          </div>
        </div>
      )}

      {/* Subscription Success Modal */}
      {showSubscriptionSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-xl p-8 shadow-2xl max-w-md mx-4 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're Subscribed! 🎉</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to <span className="font-semibold text-foreground">{planName}</span>! 
              {planTier === 'enterprise' && ' You now have access to all premium features including advanced analytics, multi-calendar support, and priority support.'}
              {planTier === 'growth' && ' You now have access to multi-calendar support and all standard features.'}
              {planTier === 'starter' && ' You now have access to web booking, Google Calendar sync, and appointment management.'}
            </p>
            <Button 
              className="bg-brand-500 hover:bg-brand-600"
              onClick={() => setShowSubscriptionSuccess(false)}
            >
              Start Exploring
            </Button>
          </div>
        </div>
      )}

      {/* Top Subscription Banner - only show if NOT subscribed */}
      {subscriptionChecked && !isSubscribed && (
        <div className="bg-brand-500 border-b border-brand-600">
          <div className="container mx-auto max-w-6xl px-6 py-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-white">
                <Lock className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">
                  <span className="hidden sm:inline">Unlock all features — </span>
                  Subscribe for calendar sync, the AI booking line on Growth+, and analytics.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs !border-white/60 !bg-black/30 !text-white hover:!bg-black/45 hover:!text-white"
                  onClick={syncSubscription}
                  disabled={isSyncingSubscription}
                >
                  {isSyncingSubscription ? 'Syncing...' : 'Already paid? Sync'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 font-semibold shadow-md !border-white/90 !bg-white !text-neutral-900 hover:!bg-neutral-100 hover:!text-neutral-950 dark:!bg-white dark:!text-neutral-950 dark:hover:!bg-neutral-100"
                  onClick={() => router.push('/pricing?paywall=1')}
                >
                  Subscribe Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TrialGateProvider token={token} businessId={primaryBusinessId}>
      <div className="container mx-auto max-w-6xl p-6">
        {forceDashboard && (
          <ProvisioningAlertBanner token={token} show={!!token} />
        )}
        {/* Recent Activity — calls and bookings from AI booking line */}
        {phoneSetup?.businessId && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5 shrink-0" aria-hidden /> Recent Calls
                </CardTitle>
                {recentCalls.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {callSearchQuery.trim()
                      ? `${filteredRecentCalls.length} match${filteredRecentCalls.length !== 1 ? "es" : ""} · `
                      : ""}
                    {recentCalls.length} call{recentCalls.length !== 1 ? "s" : ""} · last 7 days
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {callsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading calls...</p>
                ) : recentCalls.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No calls yet. When customers call your booking line, you&apos;ll see their calls here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="search"
                        placeholder="Search by phone number, name, or summary…"
                        value={callSearchQuery}
                        onChange={(e) => setCallSearchQuery(e.target.value)}
                        className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground"
                        aria-label="Search recent calls"
                      />
                      <select
                        value={callSortOrder}
                        onChange={(e) => setCallSortOrder(e.target.value)}
                        className="w-full sm:w-40 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shrink-0"
                        aria-label="Sort calls by date"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                    {filteredRecentCalls.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No calls match your search.</p>
                    ) : (
                  <div className="divide-y divide-border">
                    {filteredRecentCalls.map((call, i) => {
                      const callId = call.callSid || call._id || i;
                      const isSuccess = call.elevenLabs?.callSuccessful === "success" || call.status === "completed";
                      const summary = call.elevenLabs?.transcriptSummary || call.summary || "";
                      const callerPhone = call.fromNumber || call.callerPhone || "";
                      const duration = call.durationSeconds ?? call.duration;
                      const time = call.startTime || call.createdAt;
                      const isExpanded = expandedCallId === callId;
                      const langCode = callDetectedLanguageCode(call);
                      return (
                        <div
                          key={callId}
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedCallId((prev) => (prev === callId ? null : callId))}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedCallId((prev) => (prev === callId ? null : callId)); } }}
                          className="flex items-start justify-between py-3 first:pt-0 cursor-pointer hover:bg-muted/50 rounded-md -mx-1 px-1 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="text-muted-foreground shrink-0">{formatCallTime(time)}</span>
                              <span className="text-foreground">{formatPhone(callerPhone) || "—"}</span>
                              <span className="text-muted-foreground">{formatDuration(duration)}</span>
                              <span className="inline-flex shrink-0" aria-hidden>
                                {isSuccess ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                              </span>
                              {langCode ? (
                                <span
                                  title={`Call language: ${callLanguageDisplayLabel(langCode)}`}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25"
                                >
                                  {langCode.toUpperCase()}
                                </span>
                              ) : null}
                            </div>
                            {summary && (
                              <p className={`text-sm text-muted-foreground mt-1 ${isExpanded ? "" : "truncate"}`}>
                                {summary}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 shrink-0" aria-hidden /> Upcoming Bookings
                </CardTitle>
                {upcomingBookings.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {bookingSearchQuery.trim()
                      ? `${filteredUpcomingBookings.length} match${filteredUpcomingBookings.length !== 1 ? "es" : ""} · `
                      : ""}
                    {upcomingBookings.length} upcoming · next 30 days
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading bookings...</p>
                ) : upcomingBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No upcoming bookings yet. When customers book through your AI assistant, they&apos;ll appear here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        type="search"
                        placeholder="Search by guest name, phone, or service…"
                        value={bookingSearchQuery}
                        onChange={(e) => setBookingSearchQuery(e.target.value)}
                        className="flex-1 bg-background border-border text-foreground placeholder:text-muted-foreground"
                        aria-label="Search upcoming bookings"
                      />
                      <select
                        value={bookingSortOrder}
                        onChange={(e) => setBookingSortOrder(e.target.value)}
                        className="w-full sm:w-44 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shrink-0"
                        aria-label="Sort upcoming bookings"
                      >
                        <option value="newest">Soonest first</option>
                        <option value="oldest">Latest first</option>
                      </select>
                    </div>
                    {filteredUpcomingBookings.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No bookings match your search.</p>
                    ) : (
                  <div className="divide-y divide-border">
                    {filteredUpcomingBookings.map((booking, i) => {
                      const serviceName = servicesMap[booking.serviceId] || booking.serviceName || booking.serviceId || "Appointment";
                      const customer = booking.customer?.name || booking.customerName || "Unknown";
                      const phone = booking.customer?.phone || booking.customerPhone || "";
                      const startMs = getBookingStartMs(booking);
                      const start = startMs != null ? new Date(startMs) : null;
                      const endRaw = booking.slot?.end || booking.endTime;
                      const durationMin =
                        startMs != null && endRaw
                          ? Math.round((new Date(endRaw).getTime() - startMs) / 60000)
                          : booking.durationMinutes ?? null;
                      const lang =
                        booking.language != null && String(booking.language).trim() !== ""
                          ? bookingLanguageBadge(booking.language)
                          : null;
                      const providerName =
                        booking.providerName ||
                        booking.metadata?.providerName ||
                        (booking.provider && typeof booking.provider === "object" && booking.provider.name) ||
                        "";
                      const rec = booking.recurring;
                      const recurringBid = booking.id || booking.bookingId;
                      return (
                        <div key={booking.id || booking._id || i} className="py-3 first:pt-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground shrink-0">
                              {start ? formatBookingDashboardDateTime(start.toISOString(), businessDisplayTimezone) : "—"}
                            </span>
                            <span className="w-px h-4 bg-border inline-block mx-1 shrink-0 self-center" aria-hidden />
                            <span className="text-foreground">{customer}</span>
                            {rec?.enabled ? (
                              <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded font-medium">
                                {trFormat(rc.occurrence || "Appointment {n} of {total}", {
                                  n: rec.occurrenceNumber ?? 1,
                                  total: rec.totalOccurrences ?? 1,
                                })}
                              </span>
                            ) : null}
                            {lang ? (
                              <span
                                className="inline-flex items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground"
                                title={`Booked in ${lang.label}`}
                              >
                                <span aria-hidden>{lang.flag}</span>
                                {lang.label}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1">
                            <span>
                              {serviceName}
                              {durationMin ? ` (${durationMin} min)` : ""}
                              {String(providerName).trim()
                                ? ` ${trFormat(t.upcomingBookingWithProvider, { name: String(providerName).trim() })}`
                                : ""}
                            </span>
                            {phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                                {formatPhone(phone) || phone}
                              </span>
                            ) : null}
                          </div>
                          {rec?.enabled && rec.seriesId && recurringBid ? (
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => loadRecurringSeries(rec.seriesId)}
                              >
                                {rc.viewSeries}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => recurringDashboardAction("cancel_one", recurringBid)}
                              >
                                {rc.cancelThisOnly}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => recurringDashboardAction("cancel_all_future", recurringBid)}
                              >
                                {rc.cancelAllFuture}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

            <Card className="bg-card mb-6">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden />
                  Recent past bookings
                </CardTitle>
                {recentPastBookings.length > 0 && (
                  <span className="text-sm text-muted-foreground">Last 14 days · no-show actions</span>
                )}
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading…</p>
                ) : recentPastBookings.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No recent past appointments in the last 14 days. Web bookings with a card on file will appear
                    here for no-show follow-up.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {recentPastBookings.map((booking, i) => {
                      const id = booking.id || booking.bookingId || i;
                      const serviceName =
                        servicesMap[booking.serviceId] || booking.serviceName || booking.serviceId || "Appointment";
                      const customer = booking.customer?.name || booking.customerName || "Unknown";
                      const startMsPast = getBookingStartMs(booking);
                      const last4 = booking.paymentMethodSummary?.last4 || "";
                      const brand = booking.paymentMethodSummary?.brand || "";
                      const cardLabel =
                        last4
                          ? `${t.noShow.cardOnFileLabel}: •••• ${last4}${brand ? ` (${brand})` : ""}`
                          : null;
                      const isNoShow = booking.noShowStatus === "no_show";
                      const charged = booking.noShowChargeStatus === "charged";
                      const pendingCharge =
                        isNoShow && !charged && !!booking.stripePaymentMethodId;
                      const showMark =
                        !isNoShow &&
                        (booking.status == null ||
                          String(booking.status).toLowerCase() === "confirmed");
                      return (
                        <div key={id} className="py-3 first:pt-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground text-sm">
                                {startMsPast != null
                                  ? formatBookingDashboardDateTime(
                                      new Date(startMsPast).toISOString(),
                                      businessDisplayTimezone
                                    )
                                  : "—"}
                              </span>
                              {isNoShow ? (
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400 border border-red-500/40 rounded px-2 py-0.5">
                                  {t.noShow.noShowBadge}
                                </span>
                              ) : null}
                              {charged && booking.noShowChargeAmountCents != null ? (
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 rounded px-2 py-0.5">
                                  {trFormat(t.noShow.chargedBadge, {
                                    amount: new Intl.NumberFormat(undefined, {
                                      style: "currency",
                                      currency: "CAD"
                                    }).format(booking.noShowChargeAmountCents / 100)
                                  })}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-foreground">
                              {customer} · {serviceName}
                            </p>
                            {cardLabel ? (
                              <p className="text-xs text-muted-foreground">{cardLabel}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            {showMark ? (
                              <Button size="sm" variant="outline" onClick={() => markBookingNoShow(booking)}>
                                {t.noShow.markNoShow}
                              </Button>
                            ) : null}
                            {pendingCharge ? (
                              <Button size="sm" variant="secondary" onClick={() => chargeBookingNoShow(booking)}>
                                {t.noShow.chargeNoShow}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-card">
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Subscription Banner - show if not subscribed */}
              {subscriptionChecked && !isSubscribed && (
                <div className="p-4 rounded-lg bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/20 mb-4">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-brand-500">Subscription Required</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Subscribe to unlock calendar sync, phone agent features, and more.
                      </p>
                      <Button 
                        size="sm" 
                        className="mt-3 bg-brand-500 hover:bg-brand-600"
                        onClick={() => router.push('/pricing?paywall=1')}
                      >
                        View Plans
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0"
                      aria-hidden
                    >
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      Google Calendar
                      {!isSubscribed && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">
                      {!isSubscribed 
                        ? "Subscribe to activate calendar sync" 
                        : primaryCalendarProvider === "google" 
                          ? `Connected • Last synced ${googleStatus?.lastSyncedAt ? formatDT(googleStatus.lastSyncedAt) : "never"}` 
                          : "Not connected"
                      }
                    </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant={primaryCalendarProvider === "google" ? "secondary" : "default"} 
                    onClick={connectGoogle} 
                    className="shrink-0"
                    disabled={!isSubscribed}
                  >
                    {!isSubscribed ? "Locked" : primaryCalendarProvider === "google" ? "Reconnect" : "Connect"}
                  </Button>
                </div>
                {primaryCalendarProvider === "google" && isSubscribed && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button size="sm" variant="secondary" onClick={openCalendars}>Choose calendars</Button>
                    <Button size="sm" onClick={syncGoogle}>Sync now</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      onClick={() => setDisconnectConfirm("google")}
                    >
                      Disconnect
                    </Button>
                  </div>
                )}
                {calendarDialogOpen && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-sm font-medium mb-2">Select calendars</p>
                    <div className="space-y-2 max-h-60 overflow-auto pr-2">
                      {calendars?.length ? calendars.map((cal) => (
                        <label key={cal.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!cal.selected} onChange={(e) => setCalendars((prev) => prev.map((c) => c.id === cal.id ? { ...c, selected: e.target.checked } : c))} />
                          <span>{cal.summary} {cal.primary ? "(primary)" : ""}</span>
                        </label>
                      )) : <p className="text-xs text-muted-foreground">No calendars loaded</p>}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={saveCalendars} disabled={savingCalendars}>{savingCalendars ? "Saving..." : "Save"}</Button>
                      <Button size="sm" variant="secondary" onClick={() => setCalendarDialogOpen(false)}>Close</Button>
                    </div>
                  </div>
                )}
              </div>

              <PlanFeatureLock
                available={!isSubscribed || !planLimits || planLimits.outlookCalendar !== false}
                requiredPlan="Growth"
              >
                <div className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center shrink-0"
                        aria-hidden
                      >
                        <Calendar className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                      <p className="font-medium flex items-center gap-2">
                        Microsoft Outlook
                        {(!isSubscribed || (planLimits && planLimits.outlookCalendar === false)) && (
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {!isSubscribed
                          ? "Subscribe to activate Outlook calendar"
                          : planLimits && planLimits.outlookCalendar === false
                            ? "Included on Growth — upgrade to connect Outlook"
                          : primaryCalendarProvider === "microsoft"
                            ? `Connected • Last synced ${outlookStatus?.lastSyncedAt ? formatDT(outlookStatus.lastSyncedAt) : formatDT(new Date())}`
                            : "Not connected"
                        }
                      </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={primaryCalendarProvider === "microsoft" ? "secondary" : "default"}
                      onClick={
                        planLimits && planLimits.outlookCalendar === false
                          ? () => router.push('/pricing?paywall=1&feature=calendar')
                          : connectOutlook
                      }
                      className="shrink-0"
                      disabled={!isSubscribed}
                    >
                      {!isSubscribed
                        ? "Locked"
                        : planLimits && planLimits.outlookCalendar === false
                          ? "Upgrade"
                        : primaryCalendarProvider === "microsoft"
                          ? "Reconnect"
                          : "Connect"}
                    </Button>
                  </div>
                  {primaryCalendarProvider === "microsoft" && isSubscribed && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        onClick={() => setDisconnectConfirm("microsoft")}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </div>
              </PlanFeatureLock>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium">Public Booking Link</p>
                  {bookingHandle && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (primaryBusinessId) window.location.href = "/dashboard/settings/public-profile";
                        else if (user?.scheduling?.handle) window.location.href = "/dashboard/settings/scheduling";
                        else window.location.href = "/dashboard/business";
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {bookingHandle ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md break-all text-sm">
                      <ExternalLink className="h-4 w-4 shrink-0" />
                      <span className="flex-1 min-w-0 break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/b/{bookingHandle}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={copyBookingLink} className="gap-2">{copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy Link'}</Button>
                      <Button size="sm" variant="outline" onClick={() => window.open(`/b/${bookingHandle}`, '_blank')}>Preview</Button>
                    </div>
                    <div className="flex justify-center p-4 bg-white rounded-md">
                      <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${bookingHandle}`} size={160} level="H" includeMargin={true} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Set up your public booking page to accept bookings from anyone. Add a business or configure scheduling.</p>
                    <Button size="sm" onClick={() => window.location.href = '/dashboard/business'}>Add Business</Button>
                    <Button size="sm" variant="outline" onClick={() => window.location.href = '/dashboard/settings/scheduling'}>Configure Scheduling</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Booking Line Status Card */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Your Booking Line
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {phoneSetupLoading ? (
                <p className="text-muted-foreground">Loading booking line status...</p>
              ) : !phoneSetup ? (
                <p className="text-muted-foreground">
                  Set up a business to activate your AI booking line.
                </p>
              ) : (
                <>
                  {planLimits && planLimits.aiPhoneAgent === false ? (
                    <UpgradePrompt
                      feature="AI phone agent & booking line"
                      currentPlan={
                        isSubscribed
                          ? (planName || getPlanName(normalizePlanKey(planTier)))
                          : 'No plan'
                      }
                      requiredPlan="Growth"
                    />
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p>
                          <span className="font-medium">Status:</span>{" "}
                          {!!(
                            phoneSetup.assignedTwilioNumber ||
                            (phoneSetup.numberSetupMethod && phoneSetup.numberSetupMethod !== "pending")
                          ) ? (
                            <span className="text-emerald-600 font-medium">✅ Active</span>
                          ) : (
                            <span className="text-amber-600 font-medium">⏳ Setup needed</span>
                          )}
                        </p>
                        <p>
                          <span className="font-medium">Business:</span>{" "}
                          {phoneSetup.name}
                        </p>
                        {phoneSetup.assignedTwilioNumber ? (
                          <p>
                            <span className="font-medium">Book8-AI number:</span>{" "}
                            <span className="text-foreground">{formatPhone(phoneSetup.assignedTwilioNumber)}</span>
                          </p>
                        ) : (
                          <p>
                            <span className="font-medium">Book8-AI number:</span>{" "}
                            <span className="text-muted-foreground">Pending assignment</span>
                          </p>
                        )}
                        {Array.isArray(phoneSetup.forwardingFrom) && phoneSetup.forwardingFrom.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Forwarding from:</span>{" "}
                            {phoneSetup.forwardingFrom.map(formatPhone).join(", ")}
                          </p>
                        )}
                        {phoneSetup.assignedTwilioNumber ? (
                          <p className="pt-1">
                            <Link
                              href={`/help/call-forwarding?number=${encodeURIComponent(phoneSetup.assignedTwilioNumber)}`}
                              className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium"
                            >
                              {t.callForwarding.dashboardForwardHelp}
                            </Link>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/setup?businessId=${encodeURIComponent(phoneSetup.businessId)}`)}
                        >
                          {!!(
                            phoneSetup.assignedTwilioNumber ||
                            (phoneSetup.numberSetupMethod && phoneSetup.numberSetupMethod !== "pending")
                          )
                            ? "Manage"
                            : "Complete Setup"}
                        </Button>
                        {phoneSetup.assignedTwilioNumber && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              try {
                                window.location.href = `tel:${phoneSetup.assignedTwilioNumber}`;
                              } catch {}
                            }}
                          >
                            Test Call
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Business Registration Card */}
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Register and provision your business to enable AI phone agents, billing integration, and more.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => router.push('/dashboard/business')}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Manage Business
                </Button>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      primaryBusinessId
                        ? router.push(
                            `/dashboard/settings?businessId=${encodeURIComponent(primaryBusinessId)}`
                          )
                        : router.push('/dashboard/settings')
                    }
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Business settings
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/services')}
                  >
                    Services
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push('/dashboard/schedule')}
                  >
                    Business Hours
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/reviews')}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Reviews
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      primaryBusinessId
                        ? router.push(
                            `/dashboard/insights?businessId=${encodeURIComponent(primaryBusinessId)}`
                          )
                        : router.push('/dashboard/insights')
                    }
                  >
                    <LineChart className="w-4 h-4 mr-2" />
                    Revenue insights
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => router.push('/dashboard/waitlist')}
                  >
                    <span className="flex items-center">
                      <ListTodo className="w-4 h-4 mr-2" />
                      {t.waitlist?.navLabel ?? 'Waitlist'}
                    </span>
                    {waitlistWaitingCount > 0 ? (
                      <span className="rounded-full bg-violet-600/20 text-violet-300 text-xs font-medium px-2 py-0.5">
                        {waitlistWaitingCount}
                      </span>
                    ) : null}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <AnalyticsDashboard
            token={token}
            subscribed={isSubscribed}
            planLimits={planLimits}
            businessTimeZone={businessDisplayTimezone}
          />
        </div>
      </div>
      </TrialGateProvider>
      {recurringSeriesOverlay ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-series-title"
          onClick={() => setRecurringSeriesOverlay(null)}
        >
          <div
            className="bg-card border border-border rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 id="recurring-series-title" className="text-lg font-semibold text-foreground">
                {rc.seriesTitle}
              </h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRecurringSeriesOverlay(null)}>
                {rc.close}
              </Button>
            </div>
            {recurringSeriesOverlay.loading ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                {rc.loadingSeries}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recurringSeriesOverlay.bookings.map((b) => {
                  const stMs = getBookingStartMs(b);
                  const occ = b.recurring?.occurrenceNumber;
                  const tot = b.recurring?.totalOccurrences;
                  const low = (b.status || "").toLowerCase();
                  const canceled = low === "canceled" || low === "cancelled";
                  return (
                    <li
                      key={b.id || b.bookingId}
                      className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-border/60 pb-2"
                    >
                      <span className="font-medium text-foreground">
                        {occ != null && tot != null
                          ? trFormat(rc.occurrence || "Appointment {n} of {total}", { n: occ, total: tot })
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        {stMs != null
                          ? formatBookingDashboardDateTime(
                              new Date(stMs).toISOString(),
                              businessDisplayTimezone
                            )
                          : "—"}
                        {canceled ? ` · ${rc.canceledShort || "Canceled"}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
      {disconnectConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disconnect-cal-title"
          onClick={() => !disconnecting && setDisconnectConfirm(null)}
        >
          <div
            className="bg-card border border-border rounded-lg max-w-md w-full shadow-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="disconnect-cal-title" className="text-lg font-semibold mb-2">
              Disconnect {disconnectConfirm === "google" ? "Google Calendar" : "Outlook"}?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will stop new bookings from being added to your calendar. Existing events stay unchanged.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setDisconnectConfirm(null)} disabled={disconnecting}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Export with Suspense wrapper for useSearchParams
export default function Home(props) {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent {...props} />
    </Suspense>
  );
}
