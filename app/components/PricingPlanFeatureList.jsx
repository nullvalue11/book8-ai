"use client";

import { Check } from "lucide-react";
import { getPricingFeatureDisplay } from "@/lib/pricing-plan-features";

/**
 * @param {object} props
 * @param {"starter"|"growth"|"enterprise"} props.planId
 * @param {"default"|"landing"} [props.theme] — landing uses dark-page tokens
 * @param {{ ack: string | null, features: string[] } | null} [props.override] — translated feature lines for marketing locales
 */
export default function PricingPlanFeatureList({ planId, theme = "default", override = null }) {
  const fromDefault = getPricingFeatureDisplay(planId);
  const { ack, features } = override || fromDefault;
  const isLanding = theme === "landing";

  const ackCls = isLanding
    ? "text-xs text-slate-500 dark:text-white/45"
    : "text-xs text-muted-foreground";
  const dividerCls = isLanding ? "border-slate-200 dark:border-white/[0.08]" : "border-border";
  const featureCheck = isLanding
    ? "text-[#0891B2] dark:text-[#22D3EE]"
    : "text-green-600 dark:text-green-500";
  const featureText = isLanding
    ? "text-slate-800 dark:text-[#F8FAFC]"
    : "text-sm text-foreground font-medium";

  const listCls = isLanding ? "space-y-2.5 text-sm mb-8 flex-1" : "space-y-3";

  return (
    <div className={listCls}>
      {ack ? (
        <>
          <p className={`${ackCls} leading-snug`}>{ack}</p>
          <hr className={`border-0 border-t ${dividerCls} my-3`} aria-hidden />
        </>
      ) : null}
      <ul className="space-y-2.5 md:space-y-3">
        {features.map((text, i) => (
          <li key={`${i}-${text}`} className="flex items-start gap-2 md:gap-3">
            <Check className={`w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5 ${featureCheck}`} />
            <span className={featureText}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
