import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError" && error.status !== 401 && error.status !== 403) throw error;
    if (error || !data.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== "active") throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
