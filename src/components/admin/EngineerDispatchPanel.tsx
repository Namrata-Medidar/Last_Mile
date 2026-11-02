import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  allEngineersQuery,
  engineerWorkloadQuery,
  engineerService,
  useEngineerRealtime,
  type Engineer,
  type EngineerProfileUpdate,
} from "@/services/engineerService";

const badge: Record<Engineer["approval_status"], string> = {
  pending: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  suspended: "border-border bg-muted text-muted-foreground",
};

type EngineerEditDraft = Omit<EngineerProfileUpdate, "mode" | "available" | "max_active_jobs">;

function OpsEngineers({ embedded = false }: { embedded?: boolean }) {
  const { isStaff, ready, roles } = useAuth();
  const qc = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState<"All" | "L1" | "L2">("All");
  const [editingEngineerId, setEditingEngineerId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EngineerEditDraft | null>(null);
  const isSuperAdmin = roles.includes("super_admin");
  const engineers = useQuery({ ...allEngineersQuery, enabled: isStaff });
  const workload = useQuery(engineerWorkloadQuery(isStaff));
  useEngineerRealtime("ops");

  const avail = useMutation({
    mutationFn: (a: { id: string; v: boolean }) => engineerService.setAvailable(a.id, a.v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["engineers"] }),
    onError: (error: Error) => {
      console.error("Could not update engineer availability.", error);
      toast.error(error.message || "Could not update availability.");
    },
  });
  const saveProfile = useMutation({
    mutationFn: (input: { id: string; profile: EngineerEditDraft }) =>
      engineerService.updateProfile(input.id, input.profile),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engineers"] });
      setEditingEngineerId(null);
      setEditDraft(null);
      toast.success("Engineer details saved");
    },
    onError: (error: Error) => {
      console.error("Could not save engineer details.", error);
      toast.error(error.message || "Could not save engineer details.");
    },
  });
  if (ready && roles.length > 0 && !isStaff)
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Operations access only</h1>
          <Button asChild variant="link">
            <Link to="/">Back to marketplace</Link>
          </Button>
        </div>
      </div>
    );

  const list = (engineers.data ?? []).filter(
    (engineer) => !isSuperAdmin || gradeFilter === "All" || engineer.grade === gradeFilter,
  );
  const fieldClass =
    "h-9 w-full min-w-28 rounded-md border border-input bg-background px-2 text-sm text-foreground";
  const beginEditing = (engineer: Engineer) => {
    setEditingEngineerId(engineer.id);
    setEditDraft({
      full_name: engineer.full_name,
      phone: engineer.phone,
      grade: engineer.grade,
      city: engineer.city,
      kit: engineer.kit,
      approval_status: engineer.approval_status,
      status: engineer.status,
    });
  };
  const saveEngineer = (id: string) => {
    if (!editDraft) return;
    const profile = {
      ...editDraft,
      full_name: editDraft.full_name.trim(),
      phone: editDraft.phone?.trim() || null,
      city: editDraft.city.trim(),
      kit: editDraft.kit?.trim() || null,
    };
    if (!profile.full_name || !profile.city) {
      toast.error("Engineer name and city are required.");
      return;
    }
    saveProfile.mutate({ id, profile });
  };
  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-background px-4 py-8"}>
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
        {!embedded && (
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft />
              Back to marketplace
            </Link>
          </Button>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-primary">Operations</p>
            <h1 className="mt-1 text-2xl font-semibold">Engineers &amp; dispatch</h1>
          </div>
          {isSuperAdmin && (
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Filter engineers by level
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value as "All" | "L1" | "L2")}
                className="h-9 min-w-36 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                aria-label="Filter engineers by level"
              >
                <option value="All">All levels</option>
                <option value="L1">L1 engineers</option>
                <option value="L2">L2 engineers</option>
              </select>
            </label>
          )}
        </div>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <div>
              <h2 className="font-semibold">Field engineers</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {list.length} {gradeFilter === "All" ? "engineers" : `${gradeFilter} engineers`}.
                Ratings are calculated from completed jobs.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Engineer</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Kit</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Tickets working on</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {engineers.isLoading && (
                  <tr>
                    <td colSpan={9} className="p-6">
                      <div className="h-6 animate-pulse rounded bg-surface" />
                    </td>
                  </tr>
                )}
                {(engineers.isError || workload.isError) && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-destructive">
                      {engineers.isError && (
                        <>
                          Could not load engineers.{" "}
                          <button className="underline" onClick={() => void engineers.refetch()}>
                            Retry
                          </button>
                        </>
                      )}
                      {workload.isError && (
                        <>
                          {engineers.isError && " "}
                          Could not load ticket counts.{" "}
                          <button className="underline" onClick={() => void workload.refetch()}>
                            Retry
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {!engineers.isLoading && !engineers.isError && list.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      {gradeFilter === "All"
                        ? "No engineers have registered yet."
                        : `No ${gradeFilter} engineers found.`}
                    </td>
                  </tr>
                )}
                {list.map((engineer) => (
                  <tr
                    key={engineer.id}
                    className="hover:bg-muted/20"
                    onDoubleClick={(event) => {
                      const target = event.target;
                      if (
                        target instanceof HTMLElement &&
                        target.closest("button, input, select, [role='switch'], [data-no-row-edit]")
                      ) {
                        return;
                      }
                      if (editingEngineerId === null) beginEditing(engineer);
                    }}
                  >
                    <td className="px-4 py-3">
                      {editingEngineerId === engineer.id && editDraft ? (
                        <div className="space-y-2">
                          <input
                            className={fieldClass}
                            aria-label="Engineer name"
                            value={editDraft.full_name}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, full_name: event.target.value })
                            }
                          />
                          <input
                            className={fieldClass}
                            aria-label="Engineer phone"
                            value={editDraft.phone ?? ""}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, phone: event.target.value })
                            }
                          />
                        </div>
                      ) : (
                        <>
                          <p className="font-medium">{engineer.full_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {engineer.phone || "No phone provided"}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingEngineerId === engineer.id && editDraft ? (
                        <select
                          className={fieldClass}
                          aria-label="Engineer level"
                          value={editDraft.grade}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, grade: event.target.value })
                          }
                        >
                          <option value="L1">L1</option>
                          <option value="L2">L2</option>
                        </select>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                          {engineer.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingEngineerId === engineer.id && editDraft ? (
                        <input
                          className={fieldClass}
                          aria-label="Engineer city"
                          value={editDraft.city}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, city: event.target.value })
                          }
                        />
                      ) : (
                        engineer.city
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {editingEngineerId === engineer.id && editDraft ? (
                        <input
                          className={fieldClass}
                          aria-label="Engineer kit"
                          value={editDraft.kit ?? ""}
                          onChange={(event) =>
                            setEditDraft({ ...editDraft, kit: event.target.value })
                          }
                        />
                      ) : (
                        engineer.kit || "—"
                      )}
                    </td>
                    <td className="px-4 py-3" data-no-row-edit>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-warning" />
                        {engineer.ratings_count ? Number(engineer.rating).toFixed(1) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3" data-no-row-edit>
                      <Switch
                        checked={engineer.available}
                        disabled={avail.isPending}
                        onCheckedChange={(value) => avail.mutate({ id: engineer.id, v: value })}
                        aria-label={`${engineer.full_name} available`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {editingEngineerId === engineer.id && editDraft ? (
                        <div className="space-y-2">
                          <select
                            className={fieldClass}
                            aria-label="Engineer approval"
                            value={editDraft.approval_status}
                            onChange={(event) =>
                              setEditDraft({
                                ...editDraft,
                                approval_status: event.target.value as Engineer["approval_status"],
                              })
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="suspended">Suspended</option>
                          </select>
                          <select
                            className={fieldClass}
                            aria-label="Engineer account status"
                            value={editDraft.status}
                            onChange={(event) =>
                              setEditDraft({ ...editDraft, status: event.target.value })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs capitalize ${badge[engineer.approval_status]}`}
                          >
                            {engineer.approval_status}
                          </span>
                          <p className="text-xs capitalize text-muted-foreground">
                            {engineer.status}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {workload.isLoading
                        ? "…"
                        : workload.isError
                          ? "—"
                          : (workload.data?.[engineer.id] ?? 0)}
                    </td>
                    <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                      {editingEngineerId === engineer.id ? (
                        <>
                          <Button
                            size="sm"
                            disabled={saveProfile.isPending}
                            onClick={() => saveEngineer(engineer.id)}
                          >
                            {saveProfile.isPending ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saveProfile.isPending}
                            onClick={() => {
                              setEditingEngineerId(null);
                              setEditDraft(null);
                            }}
                          >
                            <X />
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Double-click row to edit
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export function EngineerDispatchPanel() {
  return <OpsEngineers embedded />;
}
