import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { splitGst } from "@/lib/pricing";
import { invoiceQuery, PAYMENT_STATUS_LABELS } from "@/services/paymentService";

export const Route = createFileRoute("/_authenticated/invoice/$id")({
  head: () => ({
    meta: [
      { title: "Invoice | Last Mile Connect" },
      { name: "description", content: "Tax invoice and payment history for your field engineer booking." },
      { property: "og:title", content: "Invoice — Last Mile Connect" },
      { property: "og:description", content: "Tax invoice with GST breakdown and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicePage,
});

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function InvoicePage() {
  const { id } = Route.useParams();
  const q = useQuery(invoiceQuery(id));
  if (q.isLoading) return <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>;
  const b = q.data?.booking;
  if (!b) return <div className="p-10 text-center"><p className="font-semibold">Invoice not found</p><Button asChild variant="link"><Link to="/">Back</Link></Button></div>;
  const t = splitGst(Number(b.total ?? 0));
  const balance = Number(b.total ?? 0) - Number(b.amount_paid);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex justify-between print:hidden">
          <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back</Link></Button>
          <Button onClick={() => window.print()}><Printer />Print / save PDF</Button>
        </div>
        <article className="rounded-lg border border-border bg-card p-8 text-sm">
          <div className="flex flex-wrap justify-between gap-4 border-b border-border pb-6">
            <div><p className="text-lg font-semibold">Last Mile Connect</p><p className="text-xs text-muted-foreground">Field engineering services</p></div>
            <div className="text-right"><p className="text-xs font-bold uppercase text-primary">Tax invoice</p><p className="font-semibold">{b.invoice_no ?? "Proforma — not yet invoiced"}</p><p className="text-xs text-muted-foreground">Order {b.ticket_no} · {new Date(b.created_at).toLocaleDateString("en-IN")}</p></div>
          </div>
          <div className="grid gap-4 py-6 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Billed to</p><p className="font-medium">{b.customer_name ?? "—"}</p><p className="text-xs text-muted-foreground">{[b.site_address, b.city].filter(Boolean).join(", ")}</p></div>
            <div className="sm:text-right"><p className="text-xs text-muted-foreground">Payment status</p><p className="font-medium">{PAYMENT_STATUS_LABELS[b.payment_status] ?? b.payment_status}</p></div>
          </div>
          <table className="w-full">
            <thead className="border-y border-border text-left text-xs text-muted-foreground"><tr><th className="py-2">Description</th><th className="py-2 text-right">Amount</th></tr></thead>
            <tbody>
              <tr><td className="py-2">{b.title} ({b.priority})</td><td className="py-2 text-right">{inr(t.taxable)}</td></tr>
              <tr><td className="py-1 text-muted-foreground">GST 18%</td><td className="py-1 text-right text-muted-foreground">{inr(t.gst)}</td></tr>
              <tr className="border-t border-border font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{inr(t.total)}</td></tr>
              <tr><td className="py-1 text-muted-foreground">Paid (net of refunds)</td><td className="py-1 text-right">{inr(Number(b.amount_paid))}</td></tr>
              <tr className="font-semibold"><td className="py-1">Balance due</td><td className="py-1 text-right">{inr(Math.max(0, balance))}</td></tr>
            </tbody>
          </table>
          {(q.data?.payments.length ?? 0) > 0 && (
            <div className="mt-6"><p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Payments & refunds</p>
              <ul className="divide-y divide-border text-xs">{q.data!.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2"><span>{new Date(p.created_at).toLocaleDateString("en-IN")} · {p.kind === "refund" ? "Refund" : "Payment"} · {p.method}{p.reference ? ` · ${p.reference}` : ""}</span><span>{p.kind === "refund" ? "−" : ""}{inr(Number(p.amount))}</span></li>
              ))}</ul>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
