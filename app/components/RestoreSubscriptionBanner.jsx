"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

function restoreErrorMessage(status, body) {
  const code = body?.error;
  if (status === 403) return "You don't have permission to restore this subscription";
  if (status === 410 && code === "cannot_restore") {
    return "Subscription has ended. Subscribe again to restore service.";
  }
  if (code === "stripe_update_failed") {
    return "Stripe could not update your subscription. Try again or contact support.";
  }
  return typeof code === "string" && code
    ? code
    : "Something went wrong. Try again or contact support.";
}

export default function RestoreSubscriptionBanner({
  businessId,
  businessName,
  periodEndIso,
  token,
  onRestored
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const periodLabel = formatPeriodDate(periodEndIso);

  async function confirmRestore() {
    if (!token) {
      toast.error("Please sign in again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ businessId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = restoreErrorMessage(res.status, data);
        toast.error(
          res.status === 410
            ? `${msg} Open /pricing to subscribe again.`
            : msg
        );
        return;
      }
      toast.success("Welcome back! Your subscription has been restored.");
      setConfirmOpen(false);
      onRestored?.();
    } catch (e) {
      toast.error(e?.message || "Something went wrong. Try again or contact support.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-medium">Subscription cancelled.</span> Active until{" "}
            <span className="font-medium">{periodLabel}</span>
            {businessName ? ` (${businessName})` : ""}.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-600/50 text-amber-950 hover:bg-amber-500/20 dark:text-amber-50"
            onClick={() => setConfirmOpen(true)}
          >
            Restore subscription
          </Button>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-[min(100%,380px)] rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 id="restore-title" className="text-lg font-semibold mb-2">
              Restore your subscription?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              You will be billed normally on your next cycle starting{" "}
              <span className="font-medium text-foreground">{periodLabel}</span>.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="button" onClick={confirmRestore} disabled={loading}>
                {loading ? "Restoring…" : "Restore"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
