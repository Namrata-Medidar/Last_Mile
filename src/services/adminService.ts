import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/services/authService";

export type AdminUser = { id: string; full_name: string | null; email: string | null; company: string | null; created_at: string; roles: AppRole[] };
export type BookingStat = { status: string; service_slug: string; total: number | null; created_at: string; priority: string };
export type RateCard = { id: string; grade: string; label: string; hourly: number; min_hours: number; min_charge: number; off_hours_hourly: number };
export type Priority = { id: string; code: string; label: string; multiplier: number; dispatch_fee: number; sla: string };
export type Setting = { id: string; key: string; value: unknown; description: string | null };
export type AuditRow = { id: string; actor_id: string | null; action: string; entity: string; entity_id: string | null; created_at: string; new_data: unknown };

async function run<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T;
}

export const bookingStatsQuery = queryOptions({
  queryKey: ["admin", "bookingStats"],
  queryFn: () => run<BookingStat[]>(supabase.from("bookings").select("status, service_slug, total, created_at, priority").limit(5000)),
});

export const usersQuery = queryOptions({
  queryKey: ["admin", "users"],
  queryFn: async (): Promise<AdminUser[]> => {
    const [profiles, roles] = await Promise.all([
      run<Omit<AdminUser, "roles">[]>(supabase.from("profiles").select("id, full_name, email, company, created_at").order("created_at")),
      run<{ user_id: string; role: AppRole }[]>(supabase.from("user_roles").select("user_id, role")),
    ]);
    return profiles.map((p) => ({ ...p, roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role) }));
  },
});

export const pricingQuery = queryOptions({
  queryKey: ["admin", "pricing"],
  queryFn: async () => {
    const [rates, priorities, settings] = await Promise.all([
      run<RateCard[]>(supabase.from("rate_cards").select("id, grade, label, hourly, min_hours, min_charge, off_hours_hourly").order("grade")),
      run<Priority[]>(supabase.from("priorities").select("id, code, label, multiplier, dispatch_fee, sla").order("code")),
      run<Setting[]>(supabase.from("system_settings").select("id, key, value, description").order("key")),
    ]);
    return { rates, priorities, settings };
  },
});

export const auditQuery = queryOptions({
  queryKey: ["admin", "audit"],
  queryFn: () => run<AuditRow[]>(supabase.from("audit_logs").select("id, actor_id, action, entity, entity_id, created_at, new_data").order("created_at", { ascending: false }).limit(200)),
});

export type Summary = { total: number; open: number; active: number; closed: number; cancelled: number; revenue: number };

export function summarise(rows: BookingStat[]): Summary {
  const s: Summary = { total: rows.length, open: 0, active: 0, closed: 0, cancelled: 0, revenue: 0 };
  for (const r of rows) {
    if (r.status === "Open") s.open++;
    else if (r.status === "In Progress") s.active++;
    else if (r.status === "Closed") { s.closed++; s.revenue += Number(r.total ?? 0); }
    else if (r.status === "Cancelled") s.cancelled++;
  }
  return s;
}

export function countBy<T>(rows: T[], key: (r: T) => string): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
}

export const adminService = {
  setRole: async (userId: string, role: AppRole, grant: boolean) => {
    const { error } = await supabase.rpc("set_user_role", { _user_id: userId, _role: role, _grant: grant });
    if (error) throw error;
  },
  updateRate: async (id: string, patch: Partial<RateCard>) => {
    const { error } = await supabase.from("rate_cards").update(patch).eq("id", id);
    if (error) throw error;
  },
  updatePriority: async (id: string, patch: Partial<Priority>) => {
    const { error } = await supabase.from("priorities").update(patch).eq("id", id);
    if (error) throw error;
  },
  updateSetting: async (id: string, value: unknown) => {
    const { error } = await supabase.from("system_settings").update({ value: value as never }).eq("id", id);
    if (error) throw error;
  },
};
