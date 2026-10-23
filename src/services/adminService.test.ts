import { describe, expect, it } from "vitest";
import { summarise } from "./adminService";

describe("summarise", () => {
  it("counts revenue only from closed orders", () => {
    const s = summarise([
      { status: "Closed", total: 5000, service_slug: "a", created_at: "", priority: "P2" },
      { status: "Open", total: 9000, service_slug: "a", created_at: "", priority: "P2" },
      { status: "Cancelled", total: 1000, service_slug: "a", created_at: "", priority: "P2" },
    ]);
    expect(s.revenue).toBe(5000);
    expect(s.total).toBe(3);
    expect(s.open).toBe(1);
  });
});
