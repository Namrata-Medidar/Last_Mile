import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { rolePermissionService } from "@/services/rolePermissionService";

export function usePermissions(enabled = true) {
  const { userId } = useAuth();
  const {
    data: permissions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["current-user-permissions", userId],
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user || user.id !== userId) return [];

      return rolePermissionService.getUserPermissions(user.id);
    },
  });

  const can = (permissionCode: string) => permissions.includes(permissionCode);

  return {
    permissions,
    can,
    isLoading,
    error,
    refetch,
  };
}
