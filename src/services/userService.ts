import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./authService";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
};

export type ProfileUpdate = Pick<Profile, "full_name" | "phone" | "company" | "address">;

export const userService = {
  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, company, address")
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
};
