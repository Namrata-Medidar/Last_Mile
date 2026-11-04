import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { generate_token } from "./tokenService";

describe("generate_token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("returns the current token without persisting a duplicate", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
      error: null,
    });

    await expect(generate_token()).resolves.toBe("test-token");
    expect(localStorage.length).toBe(0);
  });

  it("rejects an unauthenticated request", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(generate_token()).rejects.toThrow("User is not authenticated");
  });

  it("propagates session errors", async () => {
    const error = new Error("Session unavailable");
    getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(generate_token()).rejects.toBe(error);
  });
});