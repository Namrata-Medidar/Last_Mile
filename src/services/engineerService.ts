import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Engineer = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  grade: string;
  mode: string;
  city: string;
  kit: string | null;
  approval_status: "pending" | "approved" | "rejected" | "suspended";
  available: boolean;
  max_active_jobs: number;
  rating: number;
  ratings_count: number;
};

export type Job = {
  id: string;
  ticket_no: string;
  title: string;
  status: string;
  priority: string;
  city: string | null;
  customer_name: string | null;
  site_address: string | null;
  total: number | null;
  customer_rating: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const ENGINEER_COLS = "id, user_id, full_name, phone, grade, mode, city, kit, approval_status, available, max_active_jobs, rating, ratings_count";

export const myEngineerQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["engineer", "me", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Engineer | null> => {
      const { data, error } = await supabase.from("engineers").select(ENGINEER_COLS).eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data as Engineer | null;
    },
  });

export const myJobsQuery = (engineerId: string | null) =>
  queryOptions({
    queryKey: ["engineer", "jobs", engineerId],
    enabled: !!engineerId,
    retry: 2,
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, ticket_no, title, status, priority, city, customer_name, site_address, total, customer_rating, started_at, completed_at, created_at")
        .eq("engineer_id", engineerId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

export const payoutShareQuery = queryOptions({
  queryKey: ["settings", "engineer_payout_share"],
  queryFn: async (): Promise<number> => {
    const { data } = await supabase.from("system_settings").select("value").eq("key", "engineer_payout_share").maybeSingle();
    return Number(data?.value ?? 0.6);
  },
});

export const allEngineersQuery = queryOptions({
  queryKey: ["engineers", "all"],
  retry: 2,
  queryFn: async (): Promise<Engineer[]> => {
    const { data, error } = await supabase.from("engineers").select(ENGINEER_COLS).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Engineer[];
  },
});

export const unassignedQuery = queryOptions({
  queryKey: ["bookings", "unassigned"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, ticket_no, title, priority, city, customer_name, created_at")
      .is("engineer_id", null)
      .eq("status", "Open")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
});

/** Earnings for completed jobs, using the configured payout share. */
export function computeEarnings(jobs: Pick<Job, "status" | "total">[], share: number) {
  const done = jobs.filter((j) => j.status === "Closed");
  const gross = done.reduce((s, j) => s + Number(j.total ?? 0), 0);
  return { completed: done.length, gross, payout: Math.round(gross * share) };
}

export const engineerService = {
  async apply(userId: string, input: { full_name: string; phone: string; grade: string; mode: string; city: string; kit: string }) {
    const { error } = await supabase.from("engineers").insert({ user_id: userId, ...input });
    if (error) throw error;
  },
  async setAvailable(id: string, available: boolean) {
    const { error } = await supabase.from("engineers").update({ available }).eq("id", id);
    if (error) throw error;
  },
  async setMyAvailability(available: boolean) {
    const { error } = await supabase.rpc("set_my_availability", { _available: available });
    if (error) throw error;
  },
  async setApproval(id: string, approval_status: Engineer["approval_status"]) {
    const { error } = await supabase.from("engineers").update({ approval_status }).eq("id", id);
    if (error) throw error;
  },
  async jobAction(bookingId: string, action: "start" | "complete") {
    const { error } = await supabase.rpc("engineer_job_action", { _booking_id: bookingId, _action: action });
    if (error) throw error;
  },
  async autoAssign(bookingId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("assign_engineer", { _booking_id: bookingId });
    if (error) throw error;
    return data;
  },
  async rate(bookingId: string, rating: number, feedback: string) {
    const { error } = await supabase.rpc("rate_booking", { _booking_id: bookingId, _rating: rating, _feedback: feedback });
    if (error) throw error;
  },
};

export function useEngineerRealtime(key: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`engineer-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => qc.invalidateQueries({ queryKey: ["engineer"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "engineers" }, () => {
        qc.invalidateQueries({ queryKey: ["engineer"] });
        qc.invalidateQueries({ queryKey: ["engineers"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [key, qc]);
}
