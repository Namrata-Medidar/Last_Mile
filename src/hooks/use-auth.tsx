import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { userService, type Profile } from "@/services/userService";
import { isStaff, type AppRole } from "@/services/authService";

type AuthState = {
  ready: boolean;
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
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
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
