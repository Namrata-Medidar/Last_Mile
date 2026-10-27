import { useEffect } from "react";
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

/** Shape the existing order screens already use. */
export type Ticket = {
  dbId: string;
  id: string;
  title: string;
  status: "Open" | "In Progress" | "Closed" | "Cancelled";
  priority: string;
  engineer: string;
  assigneePhone: string;
  updated: string;
  city: string;
  customer: string;
  progress: number;
  unreadComments: number;
  lastContact?: string;
  total: number | null;
  rating: number | null;
};

export type TicketUpdate = Partial<Pick<Ticket, "status" | "engineer" | "assigneePhone" | "progress" | "lastContact">>;

export type NewBooking = {
  clientRequestId?: string;
  level: string;
  count: number;
  priority: string;
  total: number;
  gst?: number;
  totalPayable?: number;
  customerType?: "existing" | "new";
  customer?: {
    name: string;
    contactName: string;
    email: string;
    phone: string;
    billingAddress: string;
    gstin: string;
  };
  start_date?: string;
  end_date?: string;
  duration?: "4-hour" | "full-day";
  hours?: number;
  startTime?: string;
  gpsLocation?: string;
  site?: { code: string; name: string; address: string };
  contacts?: { name: string; mobile: string }[];
  issueDescription?: string;
  workInstructions?: string;
};

export type Comment = { sender: string; role: string; text: string; time: string };
export type CommentsByTicket = Record<string, { public: Comment[]; internal: Comment[] }>;

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

type Row = {
  id: string; ticket_no: string; title: string; status: string; priority: string; engineer_name: string;
  engineer_phone: string | null; updated_at: string; city: string | null; customer_name: string | null;
  progress: number; last_contact: string | null; total: number | null; customer_rating: number | null;
};

const toTicket = (r: Row): Ticket => ({
  dbId: r.id,
  id: r.ticket_no,
  title: r.title,
  status: r.status as Ticket["status"],
  priority: r.priority,
  engineer: r.engineer_name,
  assigneePhone: r.engineer_phone ?? "",
  updated: ago(r.updated_at),
  city: r.city ?? "",
  customer: r.customer_name ?? "",
  progress: r.progress,
  unreadComments: 0,
  ...(r.last_contact ? { lastContact: r.last_contact } : {}),
  total: r.total,
  rating: r.customer_rating,
});

export const ticketsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["bookings", userId],
    enabled: !!userId,
    retry: 2,
    queryFn: async (): Promise<Ticket[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, ticket_no, title, status, priority, engineer_name, engineer_phone, updated_at, city, customer_name, progress, last_contact, total, customer_rating")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(toTicket);
    },
  });

export const commentsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["booking-comments", userId],
    enabled: !!userId,
    retry: 2,
    queryFn: async (): Promise<CommentsByTicket> => {
      const { data, error } = await supabase
        .from("booking_comments")
        .select("body, author_name, author_role, visibility, created_at, bookings(ticket_no)")
        .order("created_at")
        .limit(2000);
      if (error) throw error;
      const out: CommentsByTicket = {};
      for (const c of data ?? []) {
        const key = (c.bookings as { ticket_no: string } | null)?.ticket_no;
        if (!key) continue;
        const bucket = (out[key] ??= { public: [], internal: [] });
        bucket[c.visibility as "public" | "internal"].push({ sender: c.author_name, role: c.author_role, text: c.body, time: ago(c.created_at) });
      }
      return out;
    },
  });

export const bookingService = {
  async create(customerId: string, b: NewBooking, profile: { company?: string | null; address?: string | null }): Promise<Ticket> {
    const selectFields = "id, ticket_no, title, status, priority, engineer_name, engineer_phone, updated_at, city, customer_name, progress, last_contact, total, customer_rating";
    const findByRequestId = async (): Promise<Ticket | null> => {
      if (!b.clientRequestId) return null;
      const { data, error } = await supabase
        .from("bookings")
        .select(selectFields)
        .eq("customer_id", customerId)
        .contains("details", { clientRequestId: b.clientRequestId })
        .maybeSingle();
      if (error) throw error;
      return data ? toTicket(data) : null;
    };

    const existing = await findByRequestId();
    if (existing) return existing;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        customer_id: customerId,
        title: `${b.level} field engineer dispatch`,
        priority: b.priority,
        customer_name: b.customer?.name || profile.company || null,
        site_address: b.site?.address || profile.address || null,
        city: null,
        total: Math.max(0, Math.round(b.total)),
        details: {
          level: b.level,
          count: b.count,
          priority: b.priority,
          customerType: b.customerType,
          customer: b.customer,
          gst: b.gst,
          totalPayable: b.totalPayable,
          start_date: b.start_date,
          end_date: b.end_date,
          duration: b.duration,
          hours: b.hours,
          startTime: b.startTime,
          gpsLocation: b.gpsLocation,
          site: b.site,
          contacts: b.contacts,
          issueDescription: b.issueDescription,
          workInstructions: b.workInstructions,
          ...(b.clientRequestId ? { clientRequestId: b.clientRequestId } : {}),
        },
      })
      .select(selectFields)
      .single();
    if (error) {
      if (error.code === "23505" && b.clientRequestId) {
        const duplicate = await findByRequestId();
        if (duplicate) return duplicate;
      }
      throw error;
    }
    return toTicket(data);
  },
  async createSample(customerId: string, sample: { title: string; priority: string; city: string; customer: string }): Promise<void> {
    const { error } = await supabase.from("bookings").insert({
      customer_id: customerId,
      title: sample.title,
      priority: sample.priority,
      city: sample.city,
      customer_name: sample.customer,
      details: { createdVia: "staff_sample" },
    });
    if (error) throw error;
  },
  async update(dbId: string, u: TicketUpdate): Promise<void> {
    const patch: TablesUpdate<"bookings"> = {};
    if (u.status !== undefined) patch.status = u.status;
    if (u.engineer !== undefined) patch.engineer_name = u.engineer || "Unassigned";
    if (u.assigneePhone !== undefined) patch.engineer_phone = u.assigneePhone || null;
    if (u.progress !== undefined) patch.progress = u.progress;
    if (u.lastContact !== undefined) patch.last_contact = u.lastContact;
    const { error } = await supabase.from("bookings").update(patch).eq("id", dbId);
    if (error) throw error;
  },
  async assign(
    dbId: string,
    assignee: { engineer: string; assigneePhone: string },
  ): Promise<void> {
    const { error } = await supabase.rpc("assign_booking_assignee", {
      _booking_id: dbId,
      _engineer_name: assignee.engineer,
      _engineer_phone: assignee.assigneePhone,
    });
    if (error) throw error;
  },
  async close(dbId: string): Promise<void> {
    const { error } = await supabase.rpc("close_booking_ticket", {
      _booking_id: dbId,
    });
    if (error) throw error;
  },
  async comment(dbId: string, visibility: "public" | "internal", body: string, author: { name: string; role: string }): Promise<void> {
    const { error } = await supabase.from("booking_comments").insert({ booking_id: dbId, visibility, body: body.slice(0, 4000), author_name: author.name, author_role: author.role });
    if (error) throw error;
  },
};

/** Live updates: refetch orders and comments whenever they change for this user. */
export function useBookingsRealtime(userId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`bookings-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => qc.invalidateQueries({ queryKey: ["bookings", userId] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_comments" }, () => qc.invalidateQueries({ queryKey: ["booking-comments", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);
}
