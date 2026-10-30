import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { authService, isStaff, type AppRole } from "@/services/authService";
import { userService, type Profile } from "@/services/userService";

const SESSION_TIMEOUT_MS = 900 * 1000;

type AuthState = {
  ready: boolean;
  rolesReady: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  isStaff: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      setSession(next);
      setReady(true);
    });

    void supabase.auth
      .getSession()
      .then(({ data: result, error }) => {
        if (!active) return;
        if (error)
          console.error("Could not restore the Supabase auth session:", error);
        if (!authEventReceived) setSession(result.session);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Could not restore the Supabase auth session:", error);
        setReady(true);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId || typeof document === "undefined") return;

    let lastActivityAt = Date.now();
    let backgroundAt =
      document.visibilityState === "hidden" ? Date.now() : null;
    let timeoutId: number | undefined;
    let signingOut = false;

    const signOutForTimeout = async () => {
      if (signingOut) return;
      signingOut = true;

      try {
        const { error } = await authService.signOut("local");
        if (error) {
          console.error("Could not end the expired Supabase auth session:", error);
          toast.error("Your session could not be ended. Please sign out and try again.");
          return;
        }
        toast.info("For your security, you were signed out after a period of inactivity or background time.");
        window.location.replace("/auth");
      } catch (error) {
        console.error("Could not end the expired Supabase auth session:", error);
        toast.error("Your session could not be ended. Please sign out and try again.");
      }
    };

    const checkTimeout = () => {
      const now = Date.now();
      const idleRemaining = SESSION_TIMEOUT_MS - (now - lastActivityAt);
      const backgroundRemaining =
        backgroundAt === null
          ? Number.POSITIVE_INFINITY
          : SESSION_TIMEOUT_MS - (now - backgroundAt);

      if (idleRemaining <= 0 || backgroundRemaining <= 0) {
        void signOutForTimeout();
        return;
      }

      timeoutId = window.setTimeout(
        checkTimeout,
        Math.min(idleRemaining, backgroundRemaining),
      );
    };

    const recordActivity = () => {
      if (document.visibilityState !== "visible") return;
      lastActivityAt = Date.now();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      checkTimeout();
    };

    const startBackgroundTimeout = () => {
      backgroundAt ??= Date.now();
    };

    const endBackgroundTimeout = () => {
      if (
        backgroundAt !== null &&
        Date.now() - backgroundAt >= SESSION_TIMEOUT_MS
      ) {
        void signOutForTimeout();
        return false;
      }

      backgroundAt = null;
      return true;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        startBackgroundTimeout();
      } else if (!endBackgroundTimeout()) {
        return;
      }

      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      checkTimeout();
    };

    const handleWindowFocus = () => {
      if (document.visibilityState !== "visible" || !endBackgroundTimeout()) {
        return;
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      checkTimeout();
    };

    const activityEvents: (keyof DocumentEventMap)[] = [
      "click",
      "mousemove",
      "pointermove",
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
    ];
    activityEvents.forEach((event) =>
      document.addEventListener(event, recordActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", startBackgroundTimeout);
    window.addEventListener("focus", handleWindowFocus);
    checkTimeout();

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      activityEvents.forEach((event) =>
        document.removeEventListener(event, recordActivity),
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", startBackgroundTimeout);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [userId]);

  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => userService.getProfile(userId!),
  });
  const roles = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: () => userService.getRoles(userId!),
  });
  const roleList = userId ? (roles.data ?? []) : [];

  return (
    <AuthContext.Provider
      value={{
        ready,
        rolesReady: !userId || !roles.isLoading,
        session,
        userId,
        email: session?.user.email ?? null,
        profile: userId ? (profile.data ?? null) : null,
        roles: roleList,
        hasRole: (r) => roleList.includes(r),
        isStaff: isStaff(roleList),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
