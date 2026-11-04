import type { Session, SupportedStorage, User } from "@supabase/supabase-js";

const SESSION_FIELDS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
] as const;

export function createMemoryStorage(): SupportedStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

export function createAuthStorage(storage: SupportedStorage, sessionKey: string): SupportedStorage {
  const sanitize = (value: string): string | null => {
    try {
      const session: unknown = JSON.parse(value);
      if (!session || typeof session !== "object" || Array.isArray(session)) return null;
      const source = session as Record<string, unknown>;
      if (typeof source["access_token"] !== "string" || typeof source["refresh_token"] !== "string") return null;
      return JSON.stringify(Object.fromEntries(
        SESSION_FIELDS.filter((field) => source[field] !== undefined)
          .map((field) => [field, source[field]]),
      ));
    } catch {
      return null;
    }
  };

  return {
    async getItem(key) {
      if (key !== sessionKey) return storage.getItem(key);
      await storage.removeItem("access_token");
      await storage.removeItem(`${sessionKey}-user`);
      const value = await storage.getItem(key);
      if (value === null) return null;
      const sanitized = sanitize(value);
      if (sanitized === null) await storage.removeItem(key);
      else if (sanitized !== value) await storage.setItem(key, sanitized);
      return sanitized;
    },
    async setItem(key, value) {
      if (key !== sessionKey) return storage.setItem(key, value);
      const sanitized = sanitize(value);
      if (sanitized === null) throw new Error("Invalid auth session storage payload");
      await storage.setItem(key, sanitized);
    },
    async removeItem(key) {
      await storage.removeItem(key);
      if (key === sessionKey) {
        await storage.removeItem("access_token");
        await storage.removeItem(`${sessionKey}-user`);
      }
    },
  };
}

export function assertPublicSupabaseKey(key: string): void {
  if (key.startsWith("sb_publishable_")) return;
  if (!key.startsWith("sb_secret_")) {
    try {
      const payload = key.split(".")[1];
      if (payload) {
        const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        if (claims.role === "anon") return;
      }
    } catch {}
  }
  throw new Error("The public Supabase client requires a publishable or anon key, never a privileged key");
}

export async function resolveSessionUser(
  session: Session | null,
  loadUser: (token: string) => Promise<{ data: { user: User | null }; error: unknown }>,
): Promise<Session | null> {
  if (!session) return null;
  try {
    if (typeof session.user?.id === "string" && session.user.id) return session;
  } catch {}
  try {
    const { data, error } = await loadUser(session.access_token);
    if (error || !data.user?.id) return null;
    return { ...session, user: data.user };
  } catch {
    return null;
  }
}