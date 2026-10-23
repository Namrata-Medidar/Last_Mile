// @ts-nocheck
import { useState } from "react";
import { BellRing, CalendarDays, CheckCircle2, Clock3, CreditCard, IndianRupee, MapPin, ShieldCheck, Wallet, Zap, ArrowRight } from "lucide-react";
import { panel, money } from "@/components/common/ui";
import { Button } from "@/components/ui/button";

const methods = [["UPI", Zap], ["Card", CreditCard], ["Wallet", Wallet], ["Pay Later / PO", IndianRupee]];

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-md border border-border bg-surface/50 p-3"><Icon className="h-5 w-5 text-primary" /><p className="mt-3 text-lg font-semibold">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>;
}

export function EngineerPayment({ booking, onBack, onConfirm }) {
  const [method, setMethod] = useState("UPI");
  const tax = Math.round(booking.total * 0.18);
  const total = booking.total + tax;
  return <div className="mx-auto max-w-[1320px] space-y-5">
    <div><p className="text-[10px] font-bold uppercase text-primary">Field engineer support</p><h1 className="mt-2 text-2xl font-semibold">Booking & payment</h1><p className="mt-1 text-sm text-muted-foreground">Review booking details and select a payment method.</p></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <section className={panel}><h2 className="text-sm font-semibold">Booking information</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={MapPin} label="Service location" value="Pune Store 24" /><Metric icon={CalendarDays} label="Visit date" value={booking.priority === "Urgent" ? "Immediate" : "24 Sep 2026"} /><Metric icon={Clock3} label="Service duration" value="4 hrs minimum" /><Metric icon={BellRing} label="Priority" value={booking.priority} /></div></section>
        <section className={panel}><h2 className="text-sm font-semibold">Selected service</h2><div className="mt-4 flex items-center gap-3 rounded-md bg-surface/60 p-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><ShieldCheck /></span><div className="flex-1"><p className="text-xs font-semibold">{booking.level} field engineer dispatch</p><p className="mt-1 text-[11px] text-muted-foreground">{booking.count} engineer(s) · SLA-backed service · work log and closure sign-off</p></div><p className="text-xs font-semibold">Qty {booking.count}</p></div></section>
        <section className={panel}><h2 className="text-sm font-semibold">Scope and service terms</h2><div className="mt-4 grid gap-4 text-xs sm:grid-cols-2"><div><p className="font-semibold text-success">In scope</p><p className="mt-2 leading-5 text-muted-foreground">Installation, basic configuration, testing, troubleshooting, reporting, and closure sign-off during the agreed service window.</p></div><div><p className="font-semibold text-warning">Out of scope</p><p className="mt-2 leading-5 text-muted-foreground">Night shifts, special safety work, travel outside coverage, and OEM-level support unless explicitly agreed.</p></div></div></section>
        <section className={panel}><h2 className="text-sm font-semibold">Payment method</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{methods.map(([name, Icon]) => <Button key={name} variant="outline" onClick={() => setMethod(name)} className={`h-20 flex-col ${method === name ? "border-primary bg-primary/5" : ""}`}><Icon />{name}</Button>)}</div><p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />Secure and encrypted payment.</p></section>
      </div>
      <aside className="space-y-4"><section className={panel}><h2 className="text-sm font-semibold">Booking summary</h2><div className="mt-4 space-y-3 text-xs"><p className="flex justify-between"><span className="text-muted-foreground">Request ID</span>FE-2026-00124</p><p className="flex justify-between"><span className="text-muted-foreground">Engineer level</span>{booking.level}</p><p className="flex justify-between"><span className="text-muted-foreground">Priority</span>{booking.priority}</p><p className="flex justify-between"><span className="text-muted-foreground">Site</span>Pune Store 24</p></div></section><section className={panel}><h2 className="text-sm font-semibold">Payment summary</h2><div className="mt-4 space-y-3 text-xs"><p className="flex justify-between"><span className="text-muted-foreground">Engineer service</span>{money(booking.total)}</p><p className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span>{money(tax)}</p><p className="flex justify-between border-t border-border pt-3 text-sm font-semibold"><span>Total payable</span><span className="text-primary">{money(total)}</span></p></div></section><section className={panel}><h2 className="text-sm font-semibold">Booking checklist</h2>{["Service selection", "Site and contacts", "Schedule and priority", "Payment method"].map((item) => <p key={item} className="mt-3 flex items-center justify-between text-xs"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />{item}</span><span className="text-success">Complete</span></p>)}<Button className="mt-5 w-full" onClick={onConfirm}>Confirm payment <ArrowRight /></Button><Button className="mt-2 w-full" variant="ghost" onClick={onBack}>Back to booking</Button></section></aside>
    </div>
  </div>;
}
