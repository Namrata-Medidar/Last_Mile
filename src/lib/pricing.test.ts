import { describe, expect, it } from "vitest";
import { computeQuote, isOffHours } from "./pricing";

const base = { grade: "L1", l1Count: 1, l2Count: 0, hours: 4, startHour: 10, priority: "P2", mode: "Passive", materials: [], amcLinked: false };

describe("field engineer quote", () => {
  it("L1 4-hour standard visit: 4000 + 200 platform + 18% GST", () => {
    expect(computeQuote(base).total).toBeCloseTo(4200 * 1.18);
  });
  it("L2 extra hours billed at 1500/hr beyond 4-hour minimum", () => {
    expect(computeQuote({ ...base, grade: "L2", l1Count: 0, l2Count: 1, hours: 6 }).labour).toBe(9000);
  });
  it("charges the selected duration for each day in the date range", () => {
    expect(computeQuote({ ...base, days: 3 }).labour).toBe(12000);
    expect(computeQuote({ ...base, days: 2, hours: 8 }).labour).toBe(16000);
  });
  it("work outside 08:00-20:00 uses off-hours minimum", () => {
    expect(isOffHours(18, 4)).toBe(true);
    expect(computeQuote({ ...base, startHour: 18 }).labour).toBe(6000);
  });
  it("P0 adds 35% surcharge and 2500 dispatch fee", () => {
    const q = computeQuote({ ...base, priority: "P0" });
    expect(q.prioritySurcharge).toBeCloseTo(1400);
    expect(q.dispatchFee).toBe(2500);
  });
  it("AMC discount of 1200 applied before GST", () => {
    expect(computeQuote({ ...base, amcLinked: true }).total).toBeCloseTo(3000 * 1.18);
  });
  it("materials billed only in Active mode", () => {
    const materials = [{ name: "x", rate: 850, qty: 2 }];
    expect(computeQuote({ ...base, mode: "Active", materials }).materialTotal).toBe(1700);
    expect(computeQuote({ ...base, mode: "Passive", materials }).materialTotal).toBe(0);
  });
});

import { splitGst } from "./pricing";
describe("splitGst", () => {
  it("splits an 18% GST-inclusive total", () => {
    expect(splitGst(1180)).toEqual({ taxable: 1000, gst: 180, total: 1180 });
  });
});
