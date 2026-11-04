import { afterEach, describe, expect, it, vi } from "vitest";

const { signOut, signUp } = vi.hoisted(() => ({ signOut: vi.fn(), signUp: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut, signUp } } }));
vi.mock("@/integrations/lovable", () => ({ lovable: { auth: {} } }));

import { authService, safeRedirect } from "./authService";

afterEach(() => { vi.restoreAllMocks(); });

describe("safeRedirect", () => {
  it.each([undefined, null, 123, "", "https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%5cevil.test", "/%0aevil", "/%", "/\nevil"])("rejects unsafe destination %s", (path) => {
    expect(safeRedirect(path)).toBe("/");
  });

  it("returns only a normalized local pathname", () => {
    expect(safeRedirect("/admin/users?ignored=1#section")).toBe("/admin/users");
    expect(safeRedirect("/bookings/../profile")).toBe("/profile");
  });
});

describe("auth service privacy and logout", () => {
  it("does not log signup identifiers or the signup response", async () => {
    const log = vi.spyOn(console, "log");
    const errorLog = vi.spyOn(console, "error");
    signUp.mockResolvedValue({ data: { user: { email: "private@example.test" } }, error: null });
    await authService.signUp({ email: "private@example.test", password: "not-a-real-password", fullName: "Private", company: "Company", phone: "1234567890" });
    expect(log).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("does not report logout failure when browser storage is blocked", async () => {
    signOut.mockResolvedValue({ error: null });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Blocked storage"); });
    await expect(authService.signOut()).resolves.toEqual({ error: null });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});