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

export const PRICING_GROWTH_ACK = "Includes all Starter features";

/** Growth card: exclusive bullets only (after ack + divider). */
export const PRICING_GROWTH_EXCLUSIVE_FEATURES = [
  "Multilingual AI voice (70+)",
  "AI phone agent",
  "Outlook + Google calendars",
  "SMS + Email confirmations",
  "Full analytics",
  "Priority support",
];

export const PRICING_ENTERPRISE_ACK = "Includes all Growth features";

export const PRICING_ENTERPRISE_EXCLUSIVE_FEATURES = [
  "Custom voice per language (where supported)",
  "Unlimited team members",
  "Dedicated account manager",
  "SLA guarantee",
  "API access",
  "White-label options",
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
    return { ack: PRICING_GROWTH_ACK, features: PRICING_GROWTH_EXCLUSIVE_FEATURES };
  }
  if (planId === "enterprise") {
    return { ack: PRICING_ENTERPRISE_ACK, features: PRICING_ENTERPRISE_EXCLUSIVE_FEATURES };
  }
  return { ack: null, features: [] };
}
