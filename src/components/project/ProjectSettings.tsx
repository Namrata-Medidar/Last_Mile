// @ts-nocheck
import { useMemo, useState } from "react";
import { Pencil, Plus, Save, Search, ShieldCheck, Trash2 } from "lucide-react";
import { panel, label, money } from "@/components/common/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const startingRoles = [
  { id: "role-1", name: "Nisha Shah", email: "nisha@airowire.com", phone: "+91 98765 12001", role: "Service coordinator", status: "Active" },
  { id: "role-2", name: "Rajesh Kumar", email: "rajesh@airowire.com", phone: "+91 98765 12002", role: "Field engineer", status: "Active" },
  { id: "role-3", name: "Karthik Rao", email: "karthik@airowire.com", phone: "+91 98765 12003", role: "Project manager", status: "Inactive" },
];

const emptyRole = { id: "", name: "", email: "", phone: "", role: "Field engineer", status: "Active" };

const defaultPaymentRules = {
  l1HourlyRate: 1000,
  l2HourlyRate: 1400,
  l1CapacityPerHour: 6,
  l2CapacityPerHour: 4,
  minimumHours: 4,
  cancellationMinimum: 1000,
};

export function ProjectSettings({ section = "roles", onNotify }) {
  const [roles, setRoles] = useState(startingRoles);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [roleSearch, setRoleSearch] = useState("");
  const [paymentRules, setPaymentRules] = useState(defaultPaymentRules);
  const editingRole = Boolean(roleForm.id);
  const visibleRoles = useMemo(() => roles.filter((item) => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(roleSearch.toLowerCase())), [roleSearch, roles]);
  const updateRoleForm = (key, value) => setRoleForm((current) => ({ ...current, [key]: value }));
  const saveRole = () => {
    if (!roleForm.name.trim() || !roleForm.email.trim()) return;
    if (editingRole) {
      setRoles((current) => current.map((item) => item.id === roleForm.id ? roleForm : item));
      onNotify?.({ title: "Role updated", detail: `${roleForm.name} · ${roleForm.role}` });
    } else {
      const nextRole = { ...roleForm, id: `role-${Date.now()}` };
      setRoles((current) => [nextRole, ...current]);
      onNotify?.({ title: "Role added", detail: `${nextRole.name} · ${nextRole.role}` });
    }
    setRoleForm(emptyRole);
  };
  const deleteRole = (id) => {
    const removed = roles.find((item) => item.id === id);
    setRoles((current) => current.filter((item) => item.id !== id));
    if (roleForm.id === id) setRoleForm(emptyRole);
    onNotify?.({ title: "Role deleted", detail: removed ? removed.name : "Role removed" });
  };
  const updatePaymentRule = (key, value) => setPaymentRules((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  const savePaymentRules = () => onNotify?.({ title: "Payment rules updated", detail: `L1 ${money(paymentRules.l1HourlyRate)}/hr · L2 ${money(paymentRules.l2HourlyRate)}/hr` });

  if (section === "payment") {
    return <div className="w-full space-y-5"><div><p className="text-[10px] font-bold uppercase text-primary">Airowire team settings</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Payment</h1><p className="mt-1 text-sm text-muted-foreground">Manually change engineer capacity, hourly rates, minimum booking hours, and cancellation charge.</p></div><section className={`${panel} p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Payment rules</h2><ShieldCheck className="text-primary" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3"><label><span className={label}>L1 per-hour rate</span><Input type="number" min="0" value={paymentRules.l1HourlyRate} onChange={(event) => updatePaymentRule("l1HourlyRate", event.target.value)} /></label><label><span className={label}>L2 per-hour rate</span><Input type="number" min="0" value={paymentRules.l2HourlyRate} onChange={(event) => updatePaymentRule("l2HourlyRate", event.target.value)} /></label><label><span className={label}>Minimum booking hours</span><Input type="number" min="0" value={paymentRules.minimumHours} onChange={(event) => updatePaymentRule("minimumHours", event.target.value)} /></label><label><span className={label}>L1 capacity per hour</span><Input type="number" min="0" value={paymentRules.l1CapacityPerHour} onChange={(event) => updatePaymentRule("l1CapacityPerHour", event.target.value)} /></label><label><span className={label}>L2 capacity per hour</span><Input type="number" min="0" value={paymentRules.l2CapacityPerHour} onChange={(event) => updatePaymentRule("l2CapacityPerHour", event.target.value)} /></label><label><span className={label}>Minimum cancellation charge</span><Input type="number" min="0" value={paymentRules.cancellationMinimum} onChange={(event) => updatePaymentRule("cancellationMinimum", event.target.value)} /></label></div><div className="mt-5 grid gap-3 rounded-md border border-border bg-surface/40 p-4 text-xs sm:grid-cols-2 2xl:grid-cols-3"><p><span className="block text-muted-foreground">L1 minimum</span><strong>{money(paymentRules.l1HourlyRate * paymentRules.minimumHours)}</strong></p><p><span className="block text-muted-foreground">L2 minimum</span><strong>{money(paymentRules.l2HourlyRate * paymentRules.minimumHours)}</strong></p><p><span className="block text-muted-foreground">Cancellation minimum</span><strong>{money(paymentRules.cancellationMinimum)}</strong></p></div><div className="mt-5 flex flex-wrap gap-2"><Button onClick={savePaymentRules}><Save />Save payment rules</Button><Button variant="outline" onClick={() => setPaymentRules(defaultPaymentRules)}>Reset default</Button></div></section></div>;
  }

  return <div className="w-full space-y-5"><div><p className="text-[10px] font-bold uppercase text-primary">Airowire team settings</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Role management</h1><p className="mt-1 text-sm text-muted-foreground">Create, update, search, and remove Airowire project team roles.</p></div><section className={`${panel} p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">Role details</h2><span className="rounded bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{roles.length} users</span></div><div className="mt-4 grid gap-3 rounded-md border border-border bg-surface/35 p-3 md:grid-cols-2 2xl:grid-cols-4"><label><span className={label}>Name *</span><Input value={roleForm.name} onChange={(event) => updateRoleForm("name", event.target.value)} /></label><label><span className={label}>Email *</span><Input type="email" value={roleForm.email} onChange={(event) => updateRoleForm("email", event.target.value)} /></label><label><span className={label}>Role</span><select value={roleForm.role} onChange={(event) => updateRoleForm("role", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option>Field engineer</option><option>Service coordinator</option><option>Project manager</option><option>Billing admin</option></select></label><label><span className={label}>Status</span><select value={roleForm.status} onChange={(event) => updateRoleForm("status", event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"><option>Active</option><option>Inactive</option></select></label><div className="flex flex-wrap gap-2 md:col-span-2 2xl:col-span-4"><Button onClick={saveRole}><Plus />{editingRole ? "Update role" : "Add role"}</Button>{editingRole && <Button variant="outline" onClick={() => setRoleForm(emptyRole)}>Cancel edit</Button>}</div></div><div className="mt-4 flex flex-wrap items-center gap-2"><div className="relative min-w-60 max-w-md flex-1"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={roleSearch} onChange={(event) => setRoleSearch(event.target.value)} placeholder="Search name, email or role" className="pl-9" /></div><span className="text-xs text-muted-foreground">{visibleRoles.length} shown</span></div><div className="mt-4 overflow-x-auto rounded-md border border-border"><div className="min-w-[720px]"><div className="grid grid-cols-[minmax(160px,1fr)_minmax(240px,1.6fr)_180px_100px] bg-surface px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground"><span>Name</span><span>Email</span><span>Role</span><span className="text-right">Actions</span></div>{visibleRoles.map((item) => <div key={item.id} className="grid grid-cols-[minmax(160px,1fr)_minmax(240px,1.6fr)_180px_100px] items-center border-t border-border px-3 py-3 text-xs"><span className="font-semibold">{item.name}</span><span className="truncate text-muted-foreground">{item.email}</span><span>{item.role}</span><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => setRoleForm(item)} aria-label={`Edit ${item.name}`}><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => deleteRole(item.id)} aria-label={`Delete ${item.name}`}><Trash2 /></Button></div></div>)}{!visibleRoles.length && <p className="border-t border-border p-6 text-center text-xs text-muted-foreground">No roles match your search.</p>}</div></div></section></div>;
}
