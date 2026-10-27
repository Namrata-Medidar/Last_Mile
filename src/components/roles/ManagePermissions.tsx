import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Loader2, Save, ShieldCheck, X } from "lucide-react";
import { AppRole, AppPermission, rolePermissionService } from "@/services/rolePermissionService";
import { usePermissions } from "@/hooks/usePermission";

type ManagePermissionsProps = {
  role: AppRole;
  onClose: () => void;
  onNotify?: (message: string, type?: "success" | "error") => void;
};

function PermissionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/50">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        aria-label={label}
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

export function ManagePermissions({ role, onClose, onNotify }: ManagePermissionsProps) {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const hasUserEditedPermissions = useRef(false);
  const initializedRoleId = useRef<string | null>(null);

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: () => rolePermissionService.getPermissions(),
    enabled: permissions.can("roles.manage_permissions"),
  });

  const rolePermissionsQuery = useQuery({
    queryKey: ["role-permissions", role.id],
    queryFn: () => rolePermissionService.getRolePermissions(role.id),
    enabled: permissions.can("roles.manage_permissions"),
  });
  useEffect(() => {
    if (initializedRoleId.current !== role.id) {
      initializedRoleId.current = role.id;
      hasUserEditedPermissions.current = false;
    }
    if (
      !permissionsQuery.isSuccess ||
      !rolePermissionsQuery.isSuccess ||
      hasUserEditedPermissions.current
    ) {
      return;
    }

    setSelectedIds(rolePermissionsQuery.data ?? []);
    setExpandedModules([
      ...new Set((permissionsQuery.data ?? []).map((permission) => permission.module)),
    ]);
  }, [
    role.id,
    permissionsQuery.isSuccess,
    permissionsQuery.data,
    rolePermissionsQuery.isSuccess,
    rolePermissionsQuery.data,
  ]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, AppPermission[]>();
    for (const permission of permissionsQuery.data ?? []) {
      const moduleName = permission.module || "Other";
      const existing = groups.get(moduleName) ?? [];
      existing.push(permission);
      groups.set(moduleName, existing);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissionsQuery.data]);

  const allPermissions = permissionsQuery.data ?? [];
  const allIds = allPermissions.map((permission) => permission.id);
  const selectedSet = new Set(selectedIds);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = allIds.some((id) => selectedSet.has(id));

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!permissions.can("roles.manage_permissions")) {
        throw new Error("Missing permission: roles.manage_permissions");
      }
      return rolePermissionService.saveRolePermissions(role.id, selectedIds);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["role-permissions", role.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["current-user-permissions"],
      });
      onNotify?.("Permissions saved successfully.", "success");
      onClose();
    },
    onError: (error: Error) => {
      onNotify?.(error.message || "Failed to save permissions.", "error");
    },
  });

  const togglePermission = (permissionId: string, checked: boolean) => {
    hasUserEditedPermissions.current = true;
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, permissionId])]
        : current.filter((id) => id !== permissionId),
    );
  };

  const toggleModule = (permissions: AppPermission[], checked: boolean) => {
    hasUserEditedPermissions.current = true;
    const ids = permissions.map((permission) => permission.id);
    setSelectedIds((current) => {
      if (checked) return [...new Set([...current, ...ids])];
      const removeIds = new Set(ids);
      return current.filter((id) => !removeIds.has(id));
    });
  };

  const toggleAll = (checked: boolean) => {
    hasUserEditedPermissions.current = true;
    setSelectedIds(checked ? allIds : []);
  };

  const toggleExpanded = (moduleName: string) => {
    setExpandedModules((current) =>
      current.includes(moduleName)
        ? current.filter((name) => name !== moduleName)
        : [...current, moduleName],
    );
  };

  const isLoading = permissionsQuery.isLoading || rolePermissionsQuery.isLoading;
  const queryError = permissionsQuery.error || rolePermissionsQuery.error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saveMutation.isPending) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-permissions-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 id="manage-permissions-title" className="text-lg font-semibold text-foreground">
                Manage Permissions
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure what this role can access and do.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            aria-label="Close permissions dialog"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-border bg-muted/20 p-4 md:overflow-y-auto md:border-b-0 md:border-r">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Role
            </p>
            <p className="font-semibold text-foreground">{role.name}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {role.description || "Configure permissions for this role."}
            </p>

            <div className="mt-5 rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground">Permission summary</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedIds.length} of {allIds.length} selected
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Selected permissions"
                aria-valuemin={0}
                aria-valuemax={allIds.length}
                aria-valuenow={selectedIds.filter((id) => allIds.includes(id)).length}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${
                      allIds.length
                        ? (selectedIds.filter((id) => allIds.includes(id)).length / allIds.length) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <nav className="mt-4 space-y-1" aria-label="Permission modules">
              <button
                type="button"
                onClick={() => setExpandedModules(groupedPermissions.map(([name]) => name))}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-primary hover:bg-primary/10"
              >
                All sections
                <span>
                  {selectedIds.filter((id) => allIds.includes(id)).length}/{allIds.length}
                </span>
              </button>
              {groupedPermissions.map(([moduleName, permissions]) => {
                const count = permissions.filter((permission) =>
                  selectedSet.has(permission.id),
                ).length;
                return (
                  <button
                    key={moduleName}
                    type="button"
                    onClick={() => {
                      setExpandedModules((current) =>
                        current.includes(moduleName)
                          ? current.filter((name) => name !== moduleName)
                          : [...current, moduleName],
                      );
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{moduleName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {count}/{permissions.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 rounded-lg border border-border p-3">
              <PermissionCheckbox
                label="Select all permissions"
                checked={allSelected}
                indeterminate={someSelected && !allSelected}
                onChange={toggleAll}
                disabled={isLoading || allIds.length === 0}
              />
              <p className="ml-7 text-xs text-muted-foreground">
                Select or deselect permissions across all sections.
              </p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading permissions...
              </div>
            )}

            {!isLoading && queryError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {(queryError as Error).message ||
                  "Could not load permissions. Check your Supabase access policies."}
              </div>
            )}

            {!isLoading && !queryError && allPermissions.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="font-medium text-foreground">No permissions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add predefined permission records to the permissions table first.
                </p>
              </div>
            )}

            {!isLoading &&
              !queryError &&
              groupedPermissions.map(([moduleName, permissions]) => {
                const selectedCount = permissions.filter((permission) =>
                  selectedSet.has(permission.id),
                ).length;
                const isExpanded = expandedModules.includes(moduleName);
                const isModuleSelected =
                  permissions.length > 0 && selectedCount === permissions.length;

                return (
                  <section
                    key={moduleName}
                    className="mb-4 overflow-hidden rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3 bg-muted/20 px-3 py-3 sm:px-4">
                      <PermissionCheckbox
                        label={`Select all ${moduleName} permissions`}
                        checked={isModuleSelected}
                        indeterminate={selectedCount > 0 && selectedCount < permissions.length}
                        onChange={(checked) => toggleModule(permissions, checked)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpanded(moduleName)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                        aria-expanded={isExpanded}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground">
                            {moduleName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {selectedCount} of {permissions.length} selected
                          </span>
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-1 gap-1 border-t border-border p-3 sm:grid-cols-2 sm:p-4">
                        {permissions.map((permission) => (
                          <div key={permission.id}>
                            <PermissionCheckbox
                              label={permission.code}
                              checked={selectedSet.has(permission.id)}
                              onChange={(checked) => togglePermission(permission.id, checked)}
                            />
                            {permission.description && (
                              <p className="-mt-1 mb-2 ml-9 text-xs text-muted-foreground">
                                {permission.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
          </main>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-muted-foreground">
            Changes are applied when you save. You can return to edit them later.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={
                !permissions.can("roles.manage_permissions") ||
                isLoading ||
                Boolean(queryError) ||
                saveMutation.isPending ||
                allPermissions.length === 0
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saveMutation.isSuccess ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
