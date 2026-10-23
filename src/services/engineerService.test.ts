import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const { computeEarnings } = await import("./engineerService");

describe("engineer earnings", () => {
  it("pays 60% of completed bookings only", () => {
    const r = computeEarnings([{ status: "Closed", total: 10000 }, { status: "Closed", total: 5000 }, { status: "Open", total: 9000 }], 0.6);
    expect(r).toEqual({ completed: 2, gross: 15000, payout: 9000 });
  });
});
