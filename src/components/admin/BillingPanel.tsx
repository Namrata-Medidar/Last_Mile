import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { billingQuery, METHODS, PAYMENT_STATUS_LABELS, paymentService, type BillableBooking } from "@/services/paymentService";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function BillingPanel() {
  const qc = useQueryClient();
  const q = useQuery(billingQuery);
  const [target, setTarget] = useState<{ b: BillableBooking; kind: "payment" | "refund" } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("Bank transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => paymentService.record({ bookingId: target!.b.id, kind: target!.kind, amount: Number(amount), method, reference, note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["admin"] }); toast.success(target?.kind === "refund" ? "Refund recorded" : "Payment recorded"); setTarget(null); },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const open = (b: BillableBooking, kind: "payment" | "refund") => {
    const due = Number(b.total ?? 0) - Number(b.amount_paid);
    setAmount(String(Math.max(0, kind === "payment" ? due : Number(b.amount_paid))));
    setReference(""); setNote(""); setMethod("Bank transfer"); setTarget({ b, kind });
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">Order</th><th className="p-3">Total</th><th className="p-3">Paid</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
        <tbody className="divide-y divide-border">{(q.data ?? []).map((b) => (
          <tr key={b.id}>
            <td className="p-3"><p className="text-xs font-bold text-primary">{b.ticket_no}{b.invoice_no ? ` · ${b.invoice_no}` : ""}</p><p className="font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{b.customer_name}</p></td>
            <td className="p-3">{inr(Number(b.total ?? 0))}</td>
            <td className="p-3">{inr(Number(b.amount_paid))}</td>
            <td className="p-3 text-xs">{PAYMENT_STATUS_LABELS[b.payment_status] ?? b.payment_status}</td>
            <td className="p-3"><div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" asChild><Link to="/invoice/$id" params={{ id: b.id }}>Invoice</Link></Button>
              <Button size="sm" onClick={() => open(b, "payment")} disabled={b.payment_status === "paid"}>Record payment</Button>
              <Button size="sm" variant="outline" onClick={() => open(b, "refund")} disabled={Number(b.amount_paid) <= 0}>Refund</Button>
            </div></td>
          </tr>
        ))}</tbody>
      </table>
      {(q.data ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders to bill yet.</p>}

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{target?.kind === "refund" ? "Record refund" : "Record payment"} · {target?.b.ticket_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs">Amount (₹)<Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="block text-xs">Method
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{METHODS.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="block text-xs">Reference (UTR / cheque no.)<Input value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} /></label>
            <label className="block text-xs">Note<Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <DialogFooter><Button disabled={m.isPending || !(Number(amount) > 0)} onClick={() => m.mutate()}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
