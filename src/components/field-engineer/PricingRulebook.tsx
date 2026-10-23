import { panel } from "@/components/common/ui";
import { CANCELLATION_FEE, inr, PRIORITIES, RATE_CARD } from "@/lib/pricing";

type EngineerLevel = "L1" | "L2" | "L1 + L2";

export function PricingRulebook({ level }: { level: EngineerLevel }) {
  const grades = level === "L1 + L2" ? ["L1", "L2"] as const : [level] as const;

  return <details className={panel} open>
    <summary className="cursor-pointer text-sm font-semibold">Pricing rulebook</summary>
    <div className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
      {grades.map((grade) => {
        const rate = RATE_CARD[grade];
        return <p key={grade}><strong className="text-foreground">{grade}:</strong> {inr(rate.hourly)}/hr, {rate.minHours}-hour minimum ({inr(rate.minCharge)}); off-hours {inr(rate.offHoursHourly)}/hr, {inr(rate.offHoursMin)} minimum.</p>;
      })}
      <p><strong className="text-foreground">Priority:</strong> {Object.values(PRIORITIES).map((priority) => `${priority.label} (+${Math.round((priority.multiplier - 1) * 100)}%)`).join("; ")}.</p>
      {/* <p><strong className="text-foreground">Cancellation:</strong> {inr(CANCELLATION_FEE)} minimum after one hour.</p> */}
    </div>
  </details>;
}