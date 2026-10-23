import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { ROLE_LABELS, type AppRole } from "@/services/authService";
import {
  adminService, auditQuery, bookingStatsQuery, countBy, pricingQuery, summarise, usersQuery,
  type Priority, type RateCard, type Setting,
} from "@/services/adminService";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin & operations | Last Mile Connect" },
      { name: "description", content: "Dashboard, users, price settings, change history and analytics for Last Mile Connect." },
      { property: "og:title", content: "Admin & operations — Last Mile Connect" },
      { property: "og:description", content: "Run the field engineer marketplace: numbers, users, pricing and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const ALL_ROLES: AppRole[] = ["super_admin", "admin", "ops_manager", "engineer", "customer"];
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function AdminPage() {
  const { isStaff, ready, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  if (ready && roles.length > 0 && !isStaff)
    return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-semibold">Staff access only</h1><Button asChild variant="link"><Link to="/">Back to marketplace</Link></Button></div></div>;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back to marketplace</Link></Button>
        <div><p className="text-[10px] font-bold uppercase text-primary">Administration</p><h1 className="mt-1 text-2xl font-semibold">Admin & operations</h1></div>
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="billing">Payments</TabsTrigger>
            {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
            {isAdmin && <TabsTrigger value="pricing">Prices</TabsTrigger>}
            {isAdmin && <TabsTrigger value="audit">Change history</TabsTrigger>}
          </TabsList>
          <TabsContent value="dashboard"><Dashboard enabled={isStaff} /></TabsContent>
          <TabsContent value="billing"><BillingPanel /></TabsContent>
          {isAdmin && <TabsContent value="users"><Users /></TabsContent>}
          {isAdmin && <TabsContent value="pricing"><Pricing /></TabsContent>}
          {isAdmin && <TabsContent value="audit"><Audit /></TabsContent>}
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}

function ChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No data yet</p> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis allowDecimals={false} fontSize={11} stroke="var(--muted-foreground)" />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            <Bar dataKey="value" fill="var(--primary)" radius={4} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Dashboard({ enabled }: { enabled: boolean }) {
  const q = useQuery({ ...bookingStatsQuery, enabled });
  const rows = q.data ?? [];
  const s = summarise(rows);
  const byMonth = countBy(rows, (r) => r.created_at.slice(0, 7));
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="All orders" value={s.total} /><Stat label="Open" value={s.open} /><Stat label="In progress" value={s.active} />
        <Stat label="Closed" value={s.closed} /><Stat label="Cancelled" value={s.cancelled} /><Stat label="Revenue (closed)" value={inr(s.revenue)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Orders per month" data={byMonth} />
        <ChartCard title="Orders by service" data={countBy(rows, (r) => r.service_slug)} />
        <ChartCard title="Orders by priority" data={countBy(rows, (r) => r.priority)} />
        <ChartCard title="Orders by status" data={countBy(rows, (r) => r.status)} />
      </div>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const { userId, roles: myRoles } = useAuth();
  const q = useQuery(usersQuery);
  const [search, setSearch] = useState("");
  const m = useMutation({
    mutationFn: (a: { id: string; role: AppRole; grant: boolean }) => adminService.setRole(a.id, a.role, a.grant),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); toast.success("Access updated"); },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });
  const list = (q.data ?? []).filter((u) => `${u.full_name} ${u.email} ${u.company}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="mt-4 space-y-3">
      <Input placeholder="Search by name, email or company" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">User</th>{ALL_ROLES.map((r) => <th key={r} className="p-3">{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {list.map((u) => (
              <tr key={u.id}>
                <td className="p-3"><p className="font-medium">{u.full_name || "—"}{u.id === userId && " (you)"}</p><p className="text-xs text-muted-foreground">{[u.email, u.company].filter(Boolean).join(" · ")}</p></td>
                {ALL_ROLES.map((r) => (
                  <td key={r} className="p-3">
                    <Checkbox
                      checked={u.roles.includes(r)}
                      disabled={m.isPending || (r === "super_admin" && !myRoles.includes("super_admin"))}
                      onCheckedChange={(v) => m.mutate({ id: u.id, role: r, grant: v === true })}
                      aria-label={`${ROLE_LABELS[r]} for ${u.full_name ?? u.email}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>}
      </div>
    </div>
  );
}

function NumberCell({ value, onSave, step = 1 }: { value: number; onSave: (n: number) => void; step?: number }) {
  const [v, setV] = useState(String(value));
  return <Input type="number" step={step} value={v} className="h-8 w-28" onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n >= 0 && n !== Number(value)) onSave(n); }} />;
}

function Pricing() {
  const qc = useQueryClient();
  const q = useQuery(pricingQuery);
  const done = { onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "pricing"] }); toast.success("Saved"); }, onError: () => toast.error("Save failed") };
  const rate = useMutation({ mutationFn: (a: { id: string; p: Partial<RateCard> }) => adminService.updateRate(a.id, a.p), ...done });
  const prio = useMutation({ mutationFn: (a: { id: string; p: Partial<Priority> }) => adminService.updatePriority(a.id, a.p), ...done });
  const setting = useMutation({ mutationFn: (a: { id: string; v: unknown }) => adminService.updateSetting(a.id, a.v), ...done });
  if (!q.data) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="mt-4 space-y-6">
      <p className="text-xs text-muted-foreground">Changes save when you leave a field.</p>
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Engineer rates (₹)</h3>
        <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>Grade</th><th>Per hour</th><th>Minimum hours</th><th>Minimum charge</th><th>Off-hours per hour</th></tr></thead>
          <tbody>{q.data.rates.map((r) => (
            <tr key={r.id}><td className="py-2 font-medium">{r.grade} · {r.label}</td>
              <td><NumberCell value={r.hourly} onSave={(n) => rate.mutate({ id: r.id, p: { hourly: n } })} /></td>
              <td><NumberCell value={r.min_hours} onSave={(n) => rate.mutate({ id: r.id, p: { min_hours: Math.round(n) } })} /></td>
              <td><NumberCell value={r.min_charge} onSave={(n) => rate.mutate({ id: r.id, p: { min_charge: n } })} /></td>
              <td><NumberCell value={r.off_hours_hourly} onSave={(n) => rate.mutate({ id: r.id, p: { off_hours_hourly: n } })} /></td></tr>
          ))}</tbody></table>
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Priorities</h3>
        <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr><th>Priority</th><th>Surcharge multiplier</th><th>Dispatch fee (₹)</th><th>Response time</th></tr></thead>
          <tbody>{q.data.priorities.map((p) => (
            <tr key={p.id}><td className="py-2 font-medium">{p.code} · {p.label}</td>
              <td><NumberCell step={0.01} value={p.multiplier} onSave={(n) => prio.mutate({ id: p.id, p: { multiplier: n } })} /></td>
              <td><NumberCell value={p.dispatch_fee} onSave={(n) => prio.mutate({ id: p.id, p: { dispatch_fee: n } })} /></td>
              <td className="text-muted-foreground">{p.sla}</td></tr>
          ))}</tbody></table>
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-semibold">Fees & settings</h3>
        <ul className="divide-y divide-border">{q.data.settings.map((s: Setting) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="flex-1"><p className="text-sm font-medium">{s.key.replace(/_/g, " ")}</p>{s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}</div>
            {typeof s.value === "number" ? <NumberCell step={0.01} value={s.value} onSave={(n) => setting.mutate({ id: s.id, v: n })} /> : <code className="text-xs text-muted-foreground">{JSON.stringify(s.value)}</code>}
          </li>
        ))}</ul>
      </section>
    </div>
  );
}

function Audit() {
  const q = useQuery(auditQuery);
  const users = useQuery(usersQuery);
  const name = (id: string | null) => (id ? users.data?.find((u) => u.id === id)?.full_name ?? users.data?.find((u) => u.id === id)?.email ?? "Unknown" : "System");
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">What</th></tr></thead>
        <tbody className="divide-y divide-border">{(q.data ?? []).map((a) => (
          <tr key={a.id}><td className="p-3 whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString("en-IN")}</td><td className="p-3">{name(a.actor_id)}</td><td className="p-3">{a.action}</td><td className="p-3 text-xs text-muted-foreground">{a.entity}{a.entity_id ? ` · ${a.entity_id.slice(0, 8)}` : ""}</td></tr>
        ))}</tbody>
      </table>
      {(q.data ?? []).length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No changes recorded yet.</p>}
    </div>
  );
}
