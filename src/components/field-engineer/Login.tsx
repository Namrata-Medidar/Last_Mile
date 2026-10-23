// @ts-nocheck
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { panel, label } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const existingCustomers = ["ops@airtelbusiness.com", "network@relianceretail.com", "admin@axisbank.com"];

export function EngineerLogin({ onBack, onVerified }) {
  const [form, setForm] = useState({ name: "Amit Deshpande", email: "ops@airtelbusiness.com", company: "Airtel Business", address: "Pune Store 24, Baner Road, Pune", phone: "+91 98765 43210" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const existingCustomer = existingCustomers.includes(form.email.trim().toLowerCase());
  const canSubmit = form.name.trim() && form.email.trim() && form.company.trim() && form.address.trim() && form.phone.trim();
  return <div className="mx-auto max-w-2xl space-y-5"><Button variant="ghost" onClick={onBack}><ArrowLeft />Back to services</Button><section className={panel}><p className="text-[10px] font-bold uppercase text-primary">Customer registration</p><h1 className="mt-2 text-2xl font-semibold">Register to book service</h1><p className="mt-2 text-sm text-muted-foreground">Enter the required customer details before creating the service request.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className={label}>Name *</span><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label><span className={label}>Email ID *</span><Input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label><label><span className={label}>Company *</span><Input value={form.company} onChange={(event) => update("company", event.target.value)} /></label><label><span className={label}>Phone no *</span><Input value={form.phone} onChange={(event) => update("phone", event.target.value)} /></label><label className="sm:col-span-2"><span className={label}>Address *</span><Textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label></div>{existingCustomer && <div className="mt-5 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success"><strong>Existing customer verified.</strong> Agreement/contract has been made with Airowire.</div>}<Button className="mt-6 w-full" disabled={!canSubmit} onClick={() => onVerified(form)}>Register and open form <ArrowRight /></Button></section></div>;
}