// @ts-nocheck
import { ArrowRight, X } from "lucide-react";
import { ScopeList } from "@/components/common/ScopeList";
import { Button } from "@/components/ui/button";
import { fieldEngineerScope } from "./catalog";

export function ServiceModal({ service, onClose, onBook }) {
  const isFieldEngineer = service.category === "Field Engineer";
  const inScope = isFieldEngineer ? fieldEngineerScope.in : ["Agreed service delivery", "Site documentation", "Closure report"];
  const outScope = isFieldEngineer ? fieldEngineerScope.out : ["Work outside agreed scope", "Third-party materials", "Special access permits"];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-overlay/60 p-4"><section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-[10px] font-bold uppercase text-primary">{service.category}</p><h2 className="mt-1 text-xl font-semibold">{service.title}</h2></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="Close details"><X /></Button></div><div className="grid gap-5 p-5 md:grid-cols-2"><div><img src={service.image} alt="" className="aspect-video w-full rounded-md object-cover" /><h3 className="mt-5 text-sm font-semibold">What it is</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{isFieldEngineer ? "Trained engineers are deployed at your site for installation, configuration, troubleshooting, and on-ground support. They can be booked per visit or as a dedicated resource." : service.description}</p></div><div className="space-y-5"><ScopeList title="In scope" items={inScope} tone="text-success" /><ScopeList title="Out of scope" items={outScope} tone="text-warning" /></div></div>{isFieldEngineer && <div className="flex justify-end border-t border-border p-5"><Button onClick={onBook}>Book Field Engineer <ArrowRight /></Button></div>}</section></div>;
}