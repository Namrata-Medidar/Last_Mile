import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ auth: {} })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("privileged Supabase client", () => {
  it("rejects browser access before constructing a client", async () => {
    const { supabaseAdmin } = await import("./client.server");
    expect(() => supabaseAdmin.auth).toThrow("server-only");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not persist or refresh a shared server session", async () => {
    vi.stubGlobal("window", undefined);
    vi.stubEnv("SUPABASE_URL", "https://server-test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
    const { supabaseAdmin } = await import("./client.server");
    expect(supabaseAdmin.auth).toEqual({});
    expect(createClient).toHaveBeenCalledWith(expect.any(String), "test-server-key", expect.objectContaining({
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }));
  });
});