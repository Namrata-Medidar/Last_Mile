import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { allEngineersQuery, engineerService, unassignedQuery, useEngineerRealtime, type Engineer } from "@/services/engineerService";

export const Route = createFileRoute("/_authenticated/ops/engineers")({
  head: () => ({
    meta: [
      { title: "Engineer management | Last Mile Connect" },
      { name: "description", content: "Approve field engineers, manage availability and dispatch open jobs." },
      { property: "og:title", content: "Engineer management — Last Mile Connect" },
      { property: "og:description", content: "Approvals, availability and dispatch for field engineers." },
    ],
  }),
  component: OpsEngineers,
});

const badge: Record<Engineer["approval_status"], string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  suspended: "border-border bg-muted text-muted-foreground",
};

function OpsEngineers() {
  const { isStaff, ready, roles } = useAuth();
  const qc = useQueryClient();
  const engineers = useQuery({ ...allEngineersQuery, enabled: isStaff });
  const open = useQuery({ ...unassignedQuery, enabled: isStaff });
  useEngineerRealtime("ops");

  const approval = useMutation({
    mutationFn: (a: { id: string; s: Engineer["approval_status"] }) => engineerService.setApproval(a.id, a.s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engineers"] }); toast.success("Engineer updated"); },
    onError: () => toast.error("Update failed"),
  });
  const avail = useMutation({
    mutationFn: (a: { id: string; v: boolean }) => engineerService.setAvailable(a.id, a.v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["engineers"] }),
  });
  const assign = useMutation({
    mutationFn: (id: string) => engineerService.autoAssign(id),
    onSuccess: (name) => {
      if (name) toast.success(`Assigned to ${name}`); else toast.warning("No available engineer matches this job.");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: () => toast.error("Assignment failed"),
  });

  if (ready && roles.length > 0 && !isStaff)
    return <div className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-semibold">Operations access only</h1><Button asChild variant="link"><Link to="/">Back to marketplace</Link></Button></div></div>;

  const list = engineers.data ?? [];
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Back to marketplace</Link></Button>
        <div><p className="text-[10px] font-bold uppercase text-primary">Operations</p><h1 className="mt-1 text-2xl font-semibold">Engineers & dispatch</h1></div>

        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4"><h2 className="font-semibold">Waiting for an engineer ({open.data?.length ?? 0})</h2><p className="text-xs text-muted-foreground">New bookings are matched automatically by skill level, city, workload and rating. Unmatched jobs wait here.</p></div>
          {(open.data ?? []).length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Every open booking has an engineer.</p> : (
            <ul className="divide-y divide-border">
              {open.data!.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex-1"><p className="text-xs font-bold text-primary">{b.ticket_no} · {b.priority}</p><p className="text-sm font-medium">{b.title}</p><p className="text-xs text-muted-foreground">{[b.customer_name, b.city].filter(Boolean).join(" · ")}</p></div>
                  <Button size="sm" disabled={assign.isPending} onClick={() => assign.mutate(b.id)}><Zap />Auto-assign</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-3">Engineer</th><th className="p-3">Grade</th><th className="p-3">City</th><th className="p-3">Kit</th><th className="p-3">Rating</th><th className="p-3">Available</th><th className="p-3">Approval</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-border">
              {engineers.isLoading && <tr><td colSpan={8} className="p-6"><div className="h-6 animate-pulse rounded bg-surface" /></td></tr>}
              {!engineers.isLoading && list.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No engineers yet. Engineers register from their Engineer portal.</td></tr>}
              {list.map((e) => (
                <tr key={e.id}>
                  <td className="p-3"><p className="font-medium">{e.full_name}</p><p className="text-xs text-muted-foreground">{e.phone}</p></td>
                  <td className="p-3">{e.grade} · {e.mode}</td>
                  <td className="p-3">{e.city}</td>
                  <td className="p-3 text-xs">{e.kit || "—"}</td>
                  <td className="p-3"><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-warning" />{e.ratings_count ? Number(e.rating).toFixed(1) : "—"}</span></td>
                  <td className="p-3"><Switch checked={e.available} onCheckedChange={(v) => avail.mutate({ id: e.id, v })} aria-label={`${e.full_name} available`} /></td>
                  <td className="p-3"><span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${badge[e.approval_status]}`}>{e.approval_status}</span></td>
                  <td className="space-x-2 whitespace-nowrap p-3 text-right">
                    {e.approval_status !== "approved" && <Button size="sm" onClick={() => approval.mutate({ id: e.id, s: "approved" })}>Approve</Button>}
                    {e.approval_status === "pending" && <Button size="sm" variant="outline" onClick={() => approval.mutate({ id: e.id, s: "rejected" })}>Reject</Button>}
                    {e.approval_status === "approved" && <Button size="sm" variant="outline" onClick={() => approval.mutate({ id: e.id, s: "suspended" })}>Suspend</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
