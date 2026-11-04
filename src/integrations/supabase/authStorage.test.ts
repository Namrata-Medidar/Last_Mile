import { createClient, type Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPublicSupabaseKey, createAuthStorage, createMemoryStorage, resolveSessionUser } from "./authStorage";

const sessionKey = "sb-storage-test-auth-token";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "private@example.test",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Private Name", phone: "1234567890", company: "Private Company" },
  created_at: "2026-01-01T00:00:00Z",
};
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const encodeJwtPart = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const accessToken = `${encodeJwtPart({ alg: "HS256", typ: "JWT" })}.${encodeJwtPart({ sub: user.id, exp: expiresAt })}.c2lnbmF0dXJl`;
const session = {
  access_token: accessToken,
  refresh_token: "test-refresh-token",
  token_type: "bearer",
  expires_at: expiresAt,
  expires_in: 3600,
  provider_token: "private-provider-token",
  user,
};

describe("auth storage", () => {
  beforeEach(() => { localStorage.clear(); });

  it("migrates legacy sessions without storing user or provider details", async () => {
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem("access_token", "legacy-token");
    localStorage.setItem(`${sessionKey}-user`, JSON.stringify({ user }));
    const storage = createAuthStorage(localStorage, sessionKey);
    const result = JSON.parse((await storage.getItem(sessionKey))!);
    expect(result).toEqual({
      access_token: accessToken,
      refresh_token: session.refresh_token,
      token_type: "bearer",
      expires_at: expiresAt,
      expires_in: 3600,
    });
    expect(localStorage.getItem(sessionKey)).toBe(JSON.stringify(result));
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem(`${sessionKey}-user`)).toBeNull();
  });

  it("preserves PKCE verifier storage and unrelated application data", async () => {
    const storage = createAuthStorage(localStorage, sessionKey);
    await storage.setItem(`${sessionKey}-code-verifier`, "verifier");
    await storage.setItem("theme", "dark");
    expect(await storage.getItem(`${sessionKey}-code-verifier`)).toBe("verifier");
    expect(await storage.getItem("theme")).toBe("dark");
  });

  it("removes malformed sessions and rejects malformed writes", async () => {
    const storage = createAuthStorage(localStorage, sessionKey);
    localStorage.setItem(sessionKey, "not-json");
    expect(await storage.getItem(sessionKey)).toBeNull();
    expect(localStorage.getItem(sessionKey)).toBeNull();
    await expect(storage.setItem(sessionKey, "{}")).rejects.toThrow("Invalid auth session");
  });

  it("restores a real SDK session after reload by fetching the user", async () => {
    localStorage.setItem(sessionKey, JSON.stringify(session));
    const fetchUser = vi.fn(async () => new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const client = createClient("https://storage-test.supabase.co", "sb_publishable_test", {
      global: { fetch: fetchUser },
      auth: {
        storageKey: sessionKey,
        storage: createAuthStorage(localStorage, sessionKey),
        userStorage: createMemoryStorage(),
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    try {
      const { data, error } = await client.auth.getSession();
      expect(error).toBeNull();
      expect(data.session?.user.id).toBe(user.id);
      expect(fetchUser).toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem(sessionKey)!)).not.toHaveProperty("user");
      expect(localStorage.getItem(sessionKey)).not.toContain(user.email);
      expect(localStorage.getItem(`${sessionKey}-user`)).toBeNull();
      const result = await client.auth.setSession({ access_token: accessToken, refresh_token: session.refresh_token });
      expect(result.error).toBeNull();
      expect(JSON.parse(localStorage.getItem(sessionKey)!)).not.toHaveProperty("user");
      await client.auth.signOut({ scope: "local" });
      expect(localStorage.getItem(sessionKey)).toBeNull();
    } finally {
      await client.auth.stopAutoRefresh();
    }
  });
});

describe("public key boundary", () => {
  it("accepts publishable and legacy anon keys", () => {
    expect(() => assertPublicSupabaseKey("sb_publishable_test")).not.toThrow();
    expect(() => assertPublicSupabaseKey(`e30.${btoa(JSON.stringify({ role: "anon" }))}.signature`)).not.toThrow();
  });

  it("rejects secret, service role, and malformed keys without exposing them", () => {
    for (const key of ["sb_secret_private", `e30.${btoa(JSON.stringify({ role: "service_role" }))}.signature`, "invalid"]) {
      expect(() => assertPublicSupabaseKey(key)).toThrow("never a privileged key");
    }
  });
});

describe("session user recovery", () => {
  const unavailableSession = {
    ...session,
    user: new Proxy(user, { get() { throw new Error("User unavailable"); } }),
  } as Session;

  it("does not fetch for a signed-out or already hydrated session", async () => {
    const loadUser = vi.fn();
    await expect(resolveSessionUser(null, loadUser)).resolves.toBeNull();
    await expect(resolveSessionUser(session, loadUser)).resolves.toBe(session);
    expect(loadUser).not.toHaveBeenCalled();
  });

  it("fetches a missing user using the session's token", async () => {
    const loadUser = vi.fn().mockResolvedValue({ data: { user }, error: null });
    const restored = await resolveSessionUser(unavailableSession, loadUser);
    expect(restored?.user.id).toBe(user.id);
    expect(loadUser).toHaveBeenCalledWith(accessToken);
  });

  it("fails closed when the user cannot be restored", async () => {
    for (const result of [
      { data: { user: null }, error: null },
      { data: { user }, error: new Error("Unauthorized") },
    ]) {
      await expect(resolveSessionUser(unavailableSession, vi.fn().mockResolvedValue(result))).resolves.toBeNull();
    }
    await expect(resolveSessionUser(unavailableSession, vi.fn().mockRejectedValue(new Error("Offline")))).resolves.toBeNull();
  });
});