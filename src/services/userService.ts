import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import type { AppRole } from "./authService";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  status: string;
};

export type ProfileUpdate = Pick<Profile, "full_name" | "phone" | "company" | "address">;

export const userService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, company, address, status")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async getRoles(userId: string): Promise<AppRole[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw error;
    return (data ?? []).map((r) => r.role as AppRole);
  },
  async updateProfile(userId: string, update: ProfileUpdate): Promise<void> {
    const { error } = await supabase.from("profiles").update(update).eq("id", userId);
    if (error) throw error;
  },
  async getRoleNames(userId: string): Promise<string[]> {
    const { data: assignments, error } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw error;
    const ids = [
      ...new Set((assignments ?? []).flatMap((row) => (row.role_id ? [row.role_id] : []))),
    ];
    if (!ids.length) return [];
    const { data: roles, error: roleError } = await supabase
      .from("roles")
      .select("name")
      .in("id", ids)
      .eq("is_active", true)
      .order("name");
    if (roleError) throw roleError;
    return [...new Set((roles ?? []).map((role) => role.name))];
  },
};

export const userRoleNamesQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["user-role-names", userId],
    enabled: Boolean(userId),
    queryFn: () => userService.getRoleNames(userId!),
  });
