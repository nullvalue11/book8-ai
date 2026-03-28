"use client";

import { Check } from "lucide-react";
import { getPricingFeatureRows } from "@/lib/pricing-plan-features";

/**
 * @param {object} props
 * @param {"starter"|"growth"|"enterprise"} props.planId
 * @param {"default"|"landing"} [props.theme] — landing uses dark-page tokens
 */
export default function PricingPlanFeatureList({ planId, theme = "default" }) {
  const rows = getPricingFeatureRows(planId);
  const inherited = rows.filter((r) => r.inherited);
  const exclusive = rows.filter((r) => !r.inherited);
  const showSplit = inherited.length > 0 && exclusive.length > 0;

  const isLanding = theme === "landing";

  const inheritedText = isLanding ? "text-white/40" : "text-sm text-muted-foreground";
  const inheritedCheck = isLanding ? "text-white/35" : "text-muted-foreground/55";
  const exclusiveText = isLanding ? "text-[#F8FAFC]" : "text-sm text-foreground font-medium";
  const exclusiveCheck = isLanding ? "text-[#22D3EE]" : "text-green-600 dark:text-green-500";

  const tierLabel =
    planId === "growth"
      ? "Included from Starter"
      : planId === "enterprise"
        ? "Included from Starter & Growth"
        : null;

  const labelCls = isLanding
    ? "text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-2.5"
    : "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2.5";

  const dividerCls = isLanding ? "border-white/[0.08]" : "border-border";

  return (
    <ul className={isLanding ? "space-y-2.5 text-sm mb-8 flex-1" : "space-y-3"}>
      {showSplit && tierLabel ? (
        <li className="list-none mb-1 -mt-1">
          <p className={labelCls}>{tierLabel}</p>
        </li>
      ) : null}
      {inherited.map(({ text }, i) => (
        <li key={`in-${i}-${text}`} className="flex items-start gap-2 md:gap-3">
          <Check className={`w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5 ${inheritedCheck}`} />
          <span className={inheritedText}>{text}</span>
        </li>
      ))}
      {showSplit ? (
        <li className="list-none py-2" aria-hidden>
          <hr className={`border-0 border-t ${dividerCls}`} />
        </li>
      ) : null}
      {exclusive.map(({ text }, i) => (
        <li key={`ex-${i}-${text}`} className="flex items-start gap-2 md:gap-3">
          <Check className={`w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5 ${exclusiveCheck}`} />
          <span className={exclusiveText}>{text}</span>
        </li>
      ))}
    </ul>
  );
}
