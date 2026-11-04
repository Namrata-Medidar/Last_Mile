import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/usePermission";
import {
  allEngineersQuery,
  engineerWorkloadQuery,
  engineerService,
  useEngineerRealtime,
  type Engineer,
  type EngineerProfileUpdate,
} from "@/services/engineerService";

type EditableEngineerField = "full_name" | "phone" | "grade" | "city";

function OpsEngineers({ embedded = false }: { embedded?: boolean }) {
  const { isStaff, ready, roles } = useAuth();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState<"All" | "L1" | "L2">("All");
  const [hoverEditor, setHoverEditor] = useState<{
    id: string;
    field: EditableEngineerField;
    value: string;
  } | null>(null);
  const isSuperAdmin = roles.includes("super_admin");
  const canManageDispatch = isStaff || permissions.can("users.engineer_dispatch");
  const engineers = useQuery({ ...allEngineersQuery, enabled: canManageDispatch });
  const workload = useQuery(engineerWorkloadQuery(canManageDispatch));
  useEngineerRealtime("ops");

  const saveProfile = useMutation({
    mutationFn: (input: {
      id: string;
      field: EditableEngineerField;
      profile: Partial<Pick<EngineerProfileUpdate, EditableEngineerField>>;
    }) => engineerService.updateProfile(input.id, input.profile),
    onSuccess: async (_data, input) => {
      await qc.invalidateQueries({ queryKey: ["engineers"] });
      setHoverEditor((current) =>
        current?.id === input.id && current.field === input.field ? null : current,
      );
      toast.success("Engineer details updated");
    },
    onError: (error: Error) => {
      console.error("Could not save engineer details.", error);
      toast.error(error.message || "Could not save engineer details.");
    },
  });
  const updateAccess = useMutation({
    mutationFn: (input: { id: string; profile: Partial<Pick<EngineerProfileUpdate, "status">> }) =>
      engineerService.updateProfile(input.id, input.profile),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["engineers"] }),
        qc.invalidateQueries({ queryKey: ["engineer"] }),
      ]);
      toast.success("Engineer access updated.");
    },
    onError: (error: Error) => {
      console.error("Could not update engineer status.", error);
      toast.error(error.message || "Could not update engineer access.");
    },
  });
  if (permissions.isLoading)
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">Checking dispatch access…</p>
    );

  if (ready && !canManageDispatch)
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
    "h-9 w-full min-w-28 rounded-md border border-primary/50 bg-background px-2 text-sm text-foreground shadow-sm outline-none ring-2 ring-primary/15";
  const startEditing = (engineer: Engineer, field: EditableEngineerField) => {
    const rawValue = engineer[field];
    setHoverEditor({
      id: engineer.id,
      field,
      value: rawValue == null ? "" : String(rawValue),
    });
  };
  const saveEngineerField = (id: string, field: EditableEngineerField, value: string) => {
    const normalizedValue = value.trim();
    if ((field === "full_name" || field === "city") && !normalizedValue) {
      toast.error(field === "city" ? "Engineer city is required." : "Engineer name is required.");
      return;
    }
    const engineer = list.find((item) => item.id === id);
    const currentValue = engineer?.[field] ?? "";
    if (String(currentValue) === normalizedValue) {
      setHoverEditor(null);
      return;
    }
    const profile: Partial<Pick<EngineerProfileUpdate, EditableEngineerField>> =
      field === "phone"
        ? { phone: normalizedValue || null }
        : field === "grade"
          ? { grade: normalizedValue }
          : field === "full_name"
            ? { full_name: normalizedValue }
            : { city: normalizedValue };
    saveProfile.mutate({ id, field, profile });
  };
  const renderEditableField = (
    engineer: Engineer,
    field: EditableEngineerField,
    displayValue: string,
  ) => {
    const isEditing = hoverEditor?.id === engineer.id && hoverEditor.field === field;
    if (!isEditing) {
      return (
        <div
          className="min-h-9 rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-muted/60"
          onMouseEnter={() => startEditing(engineer, field)}
        >
          {displayValue || "—"}
        </div>
      );
    }

    const commonProps = {
      autoFocus: true,
      disabled: saveProfile.isPending,
      value: hoverEditor.value,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setHoverEditor({ id: engineer.id, field, value: event.target.value }),
      onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
        saveEngineerField(engineer.id, field, event.currentTarget.value),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setHoverEditor(null);
        }
      },
      className: fieldClass,
      "aria-label": `Engineer ${field.replace("_", " ")}`,
    };

    return field === "grade" ? (
      <select {...commonProps}>
        <option value="L1">L1</option>
        <option value="L2">L2</option>
      </select>
    ) : (
      <input {...commonProps} />
    );
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
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Engineer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tickets working on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {engineers.isLoading && (
                  <tr>
                    <td colSpan={6} className="p-6">
                      <div className="h-6 animate-pulse rounded bg-surface" />
                    </td>
                  </tr>
                )}
                {(engineers.isError || workload.isError) && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-destructive">
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
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      {gradeFilter === "All"
                        ? "No engineers have registered yet."
                        : `No ${gradeFilter} engineers found.`}
                    </td>
                  </tr>
                )}
                {list.map((engineer) => (
                  <tr key={engineer.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {renderEditableField(engineer, "full_name", engineer.full_name)}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableField(engineer, "phone", engineer.phone || "")}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableField(engineer, "grade", engineer.grade)}
                    </td>
                    <td className="px-4 py-3">
                      {renderEditableField(engineer, "city", engineer.city)}
                    </td>
                    <td className="px-4 py-3" data-no-row-edit>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={engineer.status === "active"}
                          disabled={!isSuperAdmin || updateAccess.isPending}
                          onCheckedChange={(active) =>
                            updateAccess.mutate({
                              id: engineer.id,
                              profile: { status: active ? "active" : "inactive" },
                            })
                          }
                          aria-label={`${engineer.full_name} account active`}
                        />
                        <span className="text-xs capitalize text-muted-foreground">
                          {engineer.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {workload.isLoading
                        ? "…"
                        : workload.isError
                          ? "—"
                          : (workload.data?.[engineer.id] ?? 0)}
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
