import { describe, expect, it } from "vitest";
import {
  cancellationFeeApplies,
  cancellationWindowDescription,
  type CancellationPolicy,
} from "./cancellationPolicyService";

const policy: CancellationPolicy = {
  fee: 750,
  freeHours: 2,
  anchor: "after_booking",
};

describe("cancellationFeeApplies", () => {
  it("applies the fee after the configured hours from booking creation", () => {
    const createdAt = "2026-10-30T10:00:00.000Z";
    expect(
      cancellationFeeApplies(policy, {
        createdAt,
        now: Date.parse("2026-10-30T11:59:59.000Z"),
      }),
    ).toBe(false);
    expect(
      cancellationFeeApplies(policy, {
        createdAt,
        now: Date.parse("2026-10-30T12:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("applies the fee within the configured hours before the visit", () => {
    const beforeVisit: CancellationPolicy = {
      ...policy,
      freeHours: 24,
      anchor: "before_visit",
    };
    expect(
      cancellationFeeApplies(beforeVisit, {
        visitDate: "2026-10-31",
        visitTime: "10:00",
        now: Date.parse("2026-10-30T09:59:00"),
      }),
    ).toBe(false);
    expect(
      cancellationFeeApplies(beforeVisit, {
        visitDate: "2026-10-31",
        visitTime: "10:00",
        now: Date.parse("2026-10-30T10:00:00"),
      }),
    ).toBe(true);
  });

  it("does not apply the fee if the selected anchor timestamp is missing", () => {
    expect(cancellationFeeApplies(policy, { now: Date.now() })).toBe(false);
    expect(
      cancellationFeeApplies(
        { ...policy, anchor: "before_visit" },
        { createdAt: "2026-10-30T10:00:00.000Z" },
      ),
    ).toBe(false);
  });
});

describe("cancellationWindowDescription", () => {
  it("describes both supported timing anchors", () => {
    expect(cancellationWindowDescription({ ...policy, freeHours: 1 })).toBe(
      "after 1 hour from booking creation",
    );
    expect(
      cancellationWindowDescription({
        ...policy,
        anchor: "before_visit",
        freeHours: 24,
      }),
    ).toBe("within 24 hours before the scheduled visit");
  });
});
