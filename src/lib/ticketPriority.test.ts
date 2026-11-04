import { describe, expect, it } from "vitest";
import { normalizeTicketPriority, ticketPriorities } from "./ticketPriority";

describe("normalizeTicketPriority", () => {
  it("supports all canonical ticket priorities", () => {
    expect(ticketPriorities.map(normalizeTicketPriority)).toEqual(["P0", "P1", "P2", "P3"]);
  });

  it("maps legacy priority labels to their canonical codes", () => {
    expect(["Urgent", "High", "Medium", "Low"].map(normalizeTicketPriority)).toEqual([
      "P0",
      "P1",
      "P2",
      "P3",
    ]);
  });

  it("trims values and preserves unknown priorities", () => {
    expect(normalizeTicketPriority("  p1 ")).toBe("P1");
    expect(normalizeTicketPriority("Custom")).toBe("Custom");
  });
});
