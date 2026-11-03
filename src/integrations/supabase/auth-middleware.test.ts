import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  createClient: vi.fn(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({ createMiddleware: () => ({ server: (handler: unknown) => handler }) }));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: mocks.getRequest }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { requireSupabaseAuth } from "./auth-middleware";

const token = "e30.e30.c2lnbmF0dXJl";
const userId = "00000000-0000-4000-8000-000000000001";
const claims = { sub: userId, aud: "authenticated", role: "authenticated" };
const next = vi.fn();
const invoke = requireSupabaseAuth as unknown as (options: { next: typeof next }) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://middleware-test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.getRequest.mockReturnValue({ headers: new Headers({ authorization: `Bearer ${token}` }) });
  mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims, getUser: mocks.getUser } });
  mocks.getClaims.mockResolvedValue({ data: { claims }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("server auth middleware", () => {
  it("forwards only verified matching user identities", async () => {
    await invoke({ next });
    expect(mocks.getUser).toHaveBeenCalledWith(token);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ context: expect.objectContaining({ userId, claims }) }));
  });

  it.each(["Bearer not-a-jwt", "Bearer e30.e30.signature extra", "Bearer " + "a".repeat(32769), "Basic credentials"])("rejects malformed authorization before constructing a client", async (authorization) => {
    mocks.getRequest.mockReturnValue({ headers: new Headers({ authorization }) });
    await expect(invoke({ next })).rejects.toThrow("Unauthorized");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    { ...claims, role: "service_role" },
    { ...claims, aud: "other-service" },
    { ...claims, sub: undefined },
  ])("rejects non-user claims", async (invalidClaims) => {
    mocks.getClaims.mockResolvedValue({ data: { claims: invalidClaims }, error: null });
    await expect(invoke({ next })).rejects.toThrow("Invalid user claims");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects failed token verification", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("Expired token") });
    await expect(invoke({ next })).rejects.toThrow("Invalid token");
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    { data: { user: null }, error: new Error("Invalid user") },
    { data: { user: { id: "another-user" } }, error: null },
  ])("rejects an invalid or mismatched user lookup", async (result) => {
    mocks.getUser.mockResolvedValue(result);
    await expect(invoke({ next })).rejects.toThrow("Invalid user");
    expect(next).not.toHaveBeenCalled();
  });
});