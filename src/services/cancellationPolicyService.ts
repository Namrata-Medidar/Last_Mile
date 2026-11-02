import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CancellationAnchor = "after_booking" | "before_visit";

export type CancellationPolicy = {
  fee: number;
  freeHours: number;
  anchor: CancellationAnchor;
};

export type CustomerCancellationPolicy = CancellationPolicy & {
  customer_id: string;
};

const DEFAULT_CANCELLATION_FEE = 1000;
const DEFAULT_FREE_HOURS = 1;

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const cancellationPolicyQuery = (customerId: string | null) =>
  queryOptions({
    queryKey: ["cancellation-policy", customerId],
    enabled: Boolean(customerId),
    queryFn: async (): Promise<CancellationPolicy> => {
      if (!customerId) throw new Error("Sign in to load cancellation terms.");

      const [policyResult, settingResult] = await Promise.all([
        supabase
          .from("customer_cancellation_policies")
          .select("customer_id, fee, free_hours, anchor")
          .eq("customer_id", customerId)
          .maybeSingle(),
        supabase
          .from("system_settings")
          .select("value")
          .eq("key", "cancellation_fee")
          .maybeSingle(),
      ]);
      if (policyResult.error) throw policyResult.error;
      if (settingResult.error) throw settingResult.error;

      if (policyResult.data) {
        return {
          fee: numberValue(policyResult.data.fee, DEFAULT_CANCELLATION_FEE),
          freeHours: numberValue(policyResult.data.free_hours, DEFAULT_FREE_HOURS),
          anchor: policyResult.data.anchor === "before_visit" ? "before_visit" : "after_booking",
        };
      }

      return {
        fee: numberValue(settingResult.data?.value, DEFAULT_CANCELLATION_FEE),
        freeHours: DEFAULT_FREE_HOURS,
        anchor: "after_booking",
      };
    },
  });

export const customerCancellationPoliciesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: ["admin", "customer-cancellation-policies"],
    enabled,
    queryFn: async (): Promise<CustomerCancellationPolicy[]> => {
      const { data, error } = await supabase
        .from("customer_cancellation_policies")
        .select("customer_id, fee, free_hours, anchor")
        .order("customer_id");
      if (error) throw error;
      return (data ?? []).map((policy) => ({
        customer_id: policy.customer_id,
        fee: numberValue(policy.fee, DEFAULT_CANCELLATION_FEE),
        freeHours: numberValue(policy.free_hours, DEFAULT_FREE_HOURS),
        anchor: policy.anchor === "before_visit" ? "before_visit" : "after_booking",
      }));
    },
  });

export const cancellationPolicyService = {
  async saveCustomerPolicy(
    customerId: string,
    policy: CancellationPolicy,
    actorId: string,
  ): Promise<void> {
    const { error } = await supabase.from("customer_cancellation_policies").upsert(
      {
        customer_id: customerId,
        fee: policy.fee,
        free_hours: policy.freeHours,
        anchor: policy.anchor,
        updated_by: actorId,
      },
      { onConflict: "customer_id" },
    );
    if (error) throw error;
  },
};

export function cancellationFeeApplies(
  policy: CancellationPolicy,
  input: {
    createdAt?: string;
    visitDate?: string;
    visitTime?: string;
    now?: number;
  },
): boolean {
  const now = input.now ?? Date.now();
  const hours = policy.freeHours * 60 * 60 * 1000;

  if (policy.anchor === "after_booking") {
    if (!input.createdAt) return false;
    const createdAt = Date.parse(input.createdAt);
    return Number.isFinite(createdAt) && now >= createdAt + hours;
  }

  if (!input.visitDate || !input.visitTime) return false;
  const visitAt = Date.parse(`${input.visitDate}T${input.visitTime}:00`);
  return Number.isFinite(visitAt) && now >= visitAt - hours;
}

export function cancellationWindowDescription(policy: CancellationPolicy): string {
  const hours = `${policy.freeHours} hour${policy.freeHours === 1 ? "" : "s"}`;
  return policy.anchor === "before_visit"
    ? `within ${hours} before the scheduled visit`
    : `after ${hours} from booking creation`;
}
