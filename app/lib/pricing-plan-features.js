/** Single source of truth for plan feature bullets (/pricing + landing). */

export const PRICING_STARTER_FEATURES = [
  "Unlimited bookings",
  "Multilingual AI voice (English + auto-detect for many languages)",
  "Google Calendar sync",
  "Public booking page",
  "Email reminders",
  "Basic analytics",
  "Call minutes: $0.10/min",
];

export const PRICING_GROWTH_EXCLUSIVE_FEATURES = [
  "Multilingual AI voice (70+ languages)",
  "Multiple event types",
  "AI phone agent",
  "Outlook + Google calendars",
  "SMS + Email confirmations",
  "Full analytics",
  "Priority support",
  "Team collaboration",
];

export const PRICING_ENTERPRISE_EXCLUSIVE_FEATURES = [
  "Custom voice per language (where supported)",
  "Unlimited team members",
  "Custom integrations",
  "Dedicated account manager",
  "SLA guarantee",
  "White-label options",
  "API access",
];

/**
 * @param {"starter"|"growth"|"enterprise"} planId
 * @returns {{ text: string, inherited: boolean }[]}
 */
export function getPricingFeatureRows(planId) {
  if (planId === "starter") {
    return PRICING_STARTER_FEATURES.map((text) => ({ text, inherited: false }));
  }
  if (planId === "growth") {
    return [
      ...PRICING_STARTER_FEATURES.map((text) => ({ text, inherited: true })),
      ...PRICING_GROWTH_EXCLUSIVE_FEATURES.map((text) => ({ text, inherited: false })),
    ];
  }
  if (planId === "enterprise") {
    return [
      ...PRICING_STARTER_FEATURES.map((text) => ({ text, inherited: true })),
      ...PRICING_GROWTH_EXCLUSIVE_FEATURES.map((text) => ({ text, inherited: true })),
      ...PRICING_ENTERPRISE_EXCLUSIVE_FEATURES.map((text) => ({ text, inherited: false })),
    ];
  }
  return [];
}
