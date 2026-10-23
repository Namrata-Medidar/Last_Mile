import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Payment = { id: string; booking_id: string; kind: "payment" | "refund"; amount: number; method: string; reference: string | null; note: string | null; created_at: string };
export type BillableBooking = {
  id: string; ticket_no: string; title: string; status: string; priority: string; customer_name: string | null; site_address: string | null;
  city: string | null; total: number | null; amount_paid: number; payment_status: string; invoice_no: string | null; created_at: string; completed_at: string | null;
};
const COLS = "id, ticket_no, title, status, priority, customer_name, site_address, city, total, amount_paid, payment_status, invoice_no, created_at, completed_at";

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid", partially_paid: "Part paid", paid: "Paid", partially_refunded: "Part refunded", refunded: "Refunded",
};
export const METHODS = ["Bank transfer", "UPI", "Cheque", "Cash", "Card"];

export const billingQuery = queryOptions({
  queryKey: ["billing"],
  queryFn: async (): Promise<BillableBooking[]> => {
    const { data, error } = await supabase.from("bookings").select(COLS).neq("status", "Cancelled").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []) as BillableBooking[];
  },
});

export const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: ["billing", "invoice", id],
    queryFn: async () => {
      const [b, p] = await Promise.all([
        supabase.from("bookings").select(COLS).eq("id", id).maybeSingle(),
        supabase.from("payments").select("id, booking_id, kind, amount, method, reference, note, created_at").eq("booking_id", id).order("created_at"),
      ]);
      if (b.error) throw b.error;
      if (p.error) throw p.error;
      return { booking: b.data as BillableBooking | null, payments: (p.data ?? []) as Payment[] };
    },
  });

export const paymentService = {
  record: async (a: { bookingId: string; kind: "payment" | "refund"; amount: number; method: string; reference: string; note: string }) => {
    const { error } = await supabase.rpc("record_payment", {
      _booking_id: a.bookingId, _kind: a.kind, _amount: a.amount, _method: a.method, _reference: a.reference, _note: a.note,
    });
    if (error) throw error;
  },
};
