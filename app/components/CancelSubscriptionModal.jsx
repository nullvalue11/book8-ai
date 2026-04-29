"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SURVEY_OPTIONS = [
  { id: "too_expensive", label: "Too expensive", value: "Too expensive" },
  { id: "not_enough_features", label: "Not enough features", value: "Not enough features" },
  { id: "doesnt_work", label: "Doesn't work for my business", value: "Doesn't work for my business" },
  { id: "switching", label: "Switching to another product", value: "Switching to another product" },
  { id: "testing", label: "Just testing", value: "Just testing" },
  { id: "other", label: "Other", value: "other" }
];

const REFUND_CENTS_BY_PLAN = {
  starter: 2900,
  growth: 9900,
  enterprise: 29900
};

const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function formatPeriodDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return String(iso);
  }
}

function clientRefundWindowHint(business) {
  const s = business?.subscription || {};
  const anchor = s.activatedAt || s.currentPeriodStart;
  if (!anchor) return false;
  return Date.now() - new Date(anchor).getTime() < REFUND_WINDOW_MS;
}

function refundCentsHint(business) {
  const plan = business?.subscription?.plan || business?.plan || "growth";
  return REFUND_CENTS_BY_PLAN[plan] ?? 9900;
}

function formatMoneyFromCents(cents, currency = "usd") {
  const n = typeof cents === "number" && !Number.isNaN(cents) ? cents / 100 : 0;
  const cur = (currency || "usd").toUpperCase();
  return `${n.toFixed(2)} ${cur}`;
}

function displayPhone(business) {
  return (
    business?.book8Number ||
    business?.existingBusinessNumber ||
    business?.phoneSetup?.assignedTwilioNumber ||
    "your Book8 phone number"
  );
}

function mapCancelError(status, body) {
  const code = body?.error;
  if (status === 400 && code === "refund_window_expired") {
    return "Refund window expired. You can cancel at the end of your billing period instead.";
  }
  if (status === 403) {
    return "You don't have permission to cancel this subscription";
  }
  if (status === 409 && code === "cancellation_in_progress") {
    return "Please wait, cancellation is being processed";
  }
  if (status === 500 && code === "refund_failed") {
    return "Refund couldn't be processed. Try again or contact support.";
  }
  if (status === 500 && code === "cancel_failed_after_refund") {
    return "Refund was issued but cancellation did not finish. Contact support — you may need to cancel in Stripe.";
  }
  if (status === 500 && code === "stripe_update_failed") {
    return "Stripe could not update your subscription. Try again or contact support.";
  }
  if (status === 500 && code === "stripe_retrieve_failed") {
    return "Could not load subscription from Stripe. Try again or contact support.";
  }
  if (typeof code === "string" && code) return code;
  return "Something went wrong. Try again or contact support.";
}

export default function CancelSubscriptionModal({ open, onClose, business, token, onCompleted }) {
  const [step, setStep] = useState(1);
  const [surveyId, setSurveyId] = useState("");
  const [otherText, setOtherText] = useState("");
  const [mode, setMode] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const eligibleHint = useMemo(() => clientRefundWindowHint(business), [business]);
  const refundCents = useMemo(() => refundCentsHint(business), [business]);
  const periodEndIso = business?.subscription?.currentPeriodEnd || null;
  const periodEndLabel = formatPeriodDate(periodEndIso);

  const reset = useCallback(() => {
    setStep(1);
    setSurveyId("");
    setOtherText("");
    setMode(null);
    setConfirmText("");
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function buildSurveyResponse() {
    const opt = SURVEY_OPTIONS.find((o) => o.id === surveyId);
    if (!opt) return "";
    if (opt.id === "other") return `Other: ${otherText.trim()}`;
    return opt.value;
  }

  function goStep1Continue() {
    if (!surveyId) return;
    if (surveyId === "other" && !otherText.trim()) {
      toast.error("Please describe why you are leaving.");
      return;
    }
    setStep(2);
  }

  function goStep2Pick(selectedMode) {
    setMode(selectedMode);
    setStep(3);
    setConfirmText("");
  }

  async function submitCancel() {
    if (confirmText !== "CANCEL" || !mode || !token || !business?.businessId) return;
    const surveyResponse = buildSurveyResponse();
    if (!surveyResponse) {
      toast.error("Survey response is missing.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          businessId: business.businessId,
          mode,
          surveyResponse
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(mapCancelError(res.status, data));
        return;
      }
      if (data.mode === "immediate") {
        const msg = `Subscription cancelled. You should receive a refund of ${formatMoneyFromCents(
          data.refundAmountCents,
          data.refundCurrency
        )} within 5-10 business days. Check your email.`;
        toast.success(msg);
      } else {
        const end = data.currentPeriodEnd ? formatPeriodDate(data.currentPeriodEnd) : periodEndLabel;
        toast.success(`Subscription cancelled. You'll have access until ${end}.`);
      }
      onClose?.();
      onCompleted?.();
    } catch (e) {
      toast.error(e?.message || "Something went wrong. Try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !business) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && step === 1) onClose?.();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-[min(100%,380px)] overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl sm:p-5">
        {step === 1 && (
          <>
            <h2 id="cancel-modal-title" className="text-lg font-semibold mb-1">
              Cancel your Book8 subscription?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Help us understand why:</p>
            <div className="space-y-2 mb-4">
              {SURVEY_OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="cancel-survey"
                    className="mt-1"
                    checked={surveyId === o.id}
                    onChange={() => setSurveyId(o.id)}
                  />
                  <span className="text-sm">{o.label}</span>
                </label>
              ))}
            </div>
            {surveyId === "other" && (
              <textarea
                className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                maxLength={500}
                placeholder="Tell us more (required)"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
              />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => onClose?.()}>
                Keep my subscription
              </Button>
              <Button type="button" onClick={goStep1Continue} disabled={!surveyId}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold mb-3">Choose how to cancel</h2>
            {eligibleHint ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">You have two options:</p>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto whitespace-normal py-3 text-left justify-start"
                    onClick={() => goStep2Pick("immediate")}
                  >
                    <span className="block font-medium">Cancel now + refund {formatMoneyFromCents(refundCents)}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Full refund, immediate access loss
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto whitespace-normal py-3 text-left justify-start"
                    onClick={() => goStep2Pick("period_end")}
                  >
                    <span className="block font-medium">Cancel at period end</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Keep using Book8 until {periodEndLabel || "the end of your billing period"}, no refund
                    </span>
                  </Button>
                </div>
                <div className="mt-4 flex justify-start">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Go back
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your refund window has passed. Your subscription will continue until{" "}
                  <span className="font-medium text-foreground">{periodEndLabel || "the end of your billing period"}</span>,
                  then cancel automatically.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => goStep2Pick("period_end")}
                >
                  Cancel at period end ({periodEndLabel || "period end"})
                </Button>
                <div className="mt-4 flex justify-start">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Go back
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your phone number <span className="font-medium text-foreground">{displayPhone(business)}</span> will be
              released on <span className="font-medium text-foreground">{periodEndLabel || "your period end date"}</span>.
              Your data (bookings, calls, services, schedules) will be permanently deleted.
            </p>
            <label className="mb-2 block text-sm font-medium">Type CANCEL to confirm:</label>
            <input
              type="text"
              autoComplete="off"
              className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CANCEL"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                Go back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={submitCancel}
                disabled={confirmText !== "CANCEL" || submitting}
              >
                {submitting ? "Cancelling…" : "Confirm cancellation"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
