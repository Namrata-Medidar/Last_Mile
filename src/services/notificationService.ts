import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  title: string;
  detail: string;
  read: boolean;
  bookingId: string | null;
};

export const notificationsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    retry: 2,
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, detail, read_at, booking_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.detail ?? "",
        read: !!n.read_at,
        bookingId: n.booking_id,
      }));
    },
  });

export const notificationService = {
  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    if (error) throw error;
  },
};

/** Live alerts: new notifications pop a toast and refresh the bell. */
export function useNotificationsRealtime(userId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as { title?: string; detail?: string };
        if (n.title) toast(n.title, n.detail ? { description: n.detail } : undefined);
        qc.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);
}
