/** Short scannable lists for /pricing + landing (exclusive bullets only on Growth/Enterprise). */

export const PRICING_CALL_MINUTES_FOOTNOTE =
  "AI phone agent minutes are metered at $0.10 CAD/min. Usage is tracked automatically.";

/** Shown on Starter only; all bright. */
export const PRICING_STARTER_CARD_FEATURES = [
  "Unlimited bookings",
  "Google Calendar sync",
  "Public booking page",
  "Email reminders",
  "Basic analytics",
];

/** BOO-68B: Fallback when marketing override missing — mirrors getHomepagePricingDisplay (EN). */
export const PRICING_GROWTH_ACK = null;

export const PRICING_GROWTH_EXCLUSIVE_FEATURES = [
  "Everything in Starter",
  "AI phone receptionist",
  "70+ language voice AI",
  "SMS confirmations & reminders",
  "No-show protection",
  "Waitlist & recurring bookings",
  "Auto review requests",
  "Up to 5 providers",
  "20 portfolio photos",
];

export const PRICING_ENTERPRISE_ACK = null;

export const PRICING_ENTERPRISE_EXCLUSIVE_FEATURES = [
  "Everything in Growth",
  "Multi-location dashboard",
  "Custom AI voice (where supported)",
  "White-label branding",
  "API access",
  "Dedicated SLA",
  "Unlimited providers",
  "Unlimited portfolio photos",
  "Priority support",
];

/**
 * @param {"starter"|"growth"|"enterprise"} planId
 * @returns {{ ack: string | null, features: string[] }}
 */
export function getPricingFeatureDisplay(planId) {
  if (planId === "starter") {
    return { ack: null, features: PRICING_STARTER_CARD_FEATURES };
  }
  if (planId === "growth") {
    return {
      ack: PRICING_GROWTH_ACK,
      features: PRICING_GROWTH_EXCLUSIVE_FEATURES,
    };
  }
  if (planId === "enterprise") {
    return {
      ack: PRICING_ENTERPRISE_ACK,
      features: PRICING_ENTERPRISE_EXCLUSIVE_FEATURES,
    };
  }
  return { ack: null, features: [] };
}
